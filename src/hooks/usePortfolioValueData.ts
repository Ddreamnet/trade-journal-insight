import { useMemo, useEffect } from 'react';
import { Trade } from '@/types/trade';
import { PartialCloseRecord, groupPartialClosesByTrade, calculateUnrealizedPnL } from '@/lib/portfolioCalc';
import { calculateT0FromTrades } from './useEquityCurveData';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { MarketAsset } from '@/types/market';
import { format, parseISO, startOfDay, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export type PortfolioCurrency = 'TL' | 'USD' | 'EUR' | 'gold' | 'silver';

const TROY_OUNCE_TO_GRAM = 31.1035;

interface CashFlowInput {
  flow_type: string;
  amount: number;
  created_at: string;
}

export interface PortfolioValuePoint {
  date: string;
  rawDate: string;
  valueTL: number;
  value: number;
  cashFlowEvent: { type: string; amount: number } | null;
  tradeEvent: { symbol: string; type: string } | null;
}

/**
 * For a given trade, compute remaining_lot at a specific day
 * by subtracting partial closes that happened on or before that day
 */
// getRemainingLotAtDay and linearInterpolatePrice are now in @/lib/portfolioCalc

export function usePortfolioValueData(
  closedTrades: Trade[],
  allTrades: Trade[],
  cashFlows: CashFlowInput[],
  partialCloses: PartialCloseRecord[],
  selectedCurrency: PortfolioCurrency,
  stockPriceMap: Map<string, Map<string, number>> = new Map(),
  priceDataMissing: string[] = []
) {
  const { getSeriesData, fetchSeries } = useMarketSeries();

  // Fetch currency data if needed
  useEffect(() => {
    if (selectedCurrency === 'USD') fetchSeries('usd');
    else if (selectedCurrency === 'EUR') fetchSeries('eur');
    else if (selectedCurrency === 'gold') fetchSeries('gold');
    else if (selectedCurrency === 'silver') fetchSeries('silver');
  }, [selectedCurrency, fetchSeries]);

  // Use allTrades for t0 (earliest trade open date)
  const t0 = useMemo(
    () => calculateT0FromTrades(allTrades.length > 0 ? allTrades : closedTrades),
    [allTrades, closedTrades]
  );

  // Group partial closes by trade_id for fast lookup
  const partialClosesByTrade = useMemo(() => {
    const map = new Map<string, PartialCloseRecord[]>();
    for (const pc of partialCloses) {
      const existing = map.get(pc.trade_id) || [];
      existing.push(pc);
      map.set(pc.trade_id, existing);
    }
    return map;
  }, [partialCloses]);

  const missingSet = useMemo(() => new Set(priceDataMissing), [priceDataMissing]);

  const result = useMemo(() => {
    if (!t0) return { points: [] as PortfolioValuePoint[], currencyFallback: false };

    const today = startOfDay(new Date());
    const t0Key = format(t0, 'yyyy-MM-dd');

    // Cash flow delta by date
    const cfDelta = new Map<string, number>();
    const cfInfo = new Map<string, { type: string; amount: number }>();
    for (const cf of cashFlows) {
      const key = format(startOfDay(parseISO(cf.created_at)), 'yyyy-MM-dd');
      const delta = cf.flow_type === 'deposit' ? cf.amount : -cf.amount;
      cfDelta.set(key, (cfDelta.get(key) || 0) + delta);
      cfInfo.set(key, { type: cf.flow_type, amount: cf.amount });
    }

    // PnL delta by date (from partial closes)
    const pnlDelta = new Map<string, number>();
    for (const pc of partialCloses) {
      if (!pc.realized_pnl) continue;
      const key = format(startOfDay(parseISO(pc.created_at)), 'yyyy-MM-dd');
      pnlDelta.set(key, (pnlDelta.get(key) || 0) + pc.realized_pnl);
    }

    // Trade entry marker by date (first trade of the day)
    const tradeEntry = new Map<string, { symbol: string; type: string }>();
    for (const t of allTrades) {
      const key = format(startOfDay(parseISO(t.created_at)), 'yyyy-MM-dd');
      if (!tradeEntry.has(key)) {
        tradeEntry.set(key, { symbol: t.stock_symbol, type: t.trade_type });
      }
    }

    // Currency conversion data
    let currencyMap: Map<string, number> | null = null;
    let currencyFallback = false;

    if (selectedCurrency !== 'TL') {
      const assetId: MarketAsset =
        selectedCurrency === 'USD' ? 'usd' : selectedCurrency === 'EUR' ? 'eur' : selectedCurrency === 'silver' ? 'silver' : 'gold';
      const seriesData = getSeriesData(assetId);
      if (seriesData?.points && seriesData.points.length > 0) {
        currencyMap = new Map(seriesData.points.map((p) => [p.date.substring(0, 10), p.value]));
      } else {
        currencyFallback = true;
      }
    }

    // Accumulate events before t0 into starting values
    let runningCash = 0;
    let runningPnL = 0;

    for (const [key, delta] of cfDelta) {
      if (key < t0Key) runningCash += delta;
    }
    for (const [key, delta] of pnlDelta) {
      if (key < t0Key) runningPnL += delta;
    }

    // Build daily series from t0 to today
    const points: PortfolioValuePoint[] = [];
    let lastCurrencyRate = 1;
    let currentDay = t0;

    while (currentDay <= today) {
      const key = format(currentDay, 'yyyy-MM-dd');

      // Add today's deltas
      runningCash += cfDelta.get(key) || 0;
      runningPnL += pnlDelta.get(key) || 0;

      // Calculate unrealized PnL for all trades open on this day
      let unrealizedPnL = 0;

      for (const trade of allTrades) {
        const tradeOpen = startOfDay(parseISO(trade.created_at));
        const tradeClosed = trade.closed_at ? startOfDay(parseISO(trade.closed_at)) : null;

        // Is this trade open on this day?
        if (tradeOpen > currentDay) continue;
        if (tradeClosed && tradeClosed <= currentDay) continue;

        // Get remaining lot at this day
        const tradePC = partialClosesByTrade.get(trade.id) || [];
        const remainingLot = getRemainingLotAtDay(trade, key, tradePC);
        if (remainingLot <= 0) continue;

        // Get current price
        let currentPrice: number;
        const symbolPrices = stockPriceMap.get(trade.stock_symbol);

        if (symbolPrices && symbolPrices.size > 0) {
          // Use actual price data
          currentPrice = symbolPrices.get(key) ?? trade.entry_price;
        } else if (missingSet.has(trade.stock_symbol)) {
          // Fallback: linear interpolation if closed, entry price if active
          if (trade.closed_at && trade.exit_price) {
            currentPrice = linearInterpolatePrice(
              trade.entry_price,
              trade.exit_price,
              tradeOpen,
              tradeClosed,
              currentDay
            );
          } else {
            currentPrice = trade.entry_price;
          }
        } else {
          currentPrice = trade.entry_price;
        }

        // Calculate unrealized PnL based on trade type
        if (trade.trade_type === 'buy') {
          unrealizedPnL += (currentPrice - trade.entry_price) * remainingLot;
        } else {
          unrealizedPnL += (trade.entry_price - currentPrice) * remainingLot;
        }
      }

      const valueTL = runningCash + runningPnL + unrealizedPnL;

      // Currency conversion with carry-forward
      let value = valueTL;
      if (currencyMap) {
        const rate = currencyMap.get(key);
        if (rate !== undefined && rate > 0) lastCurrencyRate = rate;
        // Gold and silver prices from Stooq are per troy ounce, convert to per gram
        const effectiveRate = (selectedCurrency === 'gold' || selectedCurrency === 'silver')
          ? lastCurrencyRate / TROY_OUNCE_TO_GRAM
          : lastCurrencyRate;
        value = valueTL / effectiveRate;
      }

      points.push({
        date: format(currentDay, 'd MMM', { locale: tr }),
        rawDate: key,
        valueTL,
        value,
        cashFlowEvent: cfInfo.get(key) || null,
        tradeEvent: tradeEntry.get(key) || null,
      });

      currentDay = addDays(currentDay, 1);
    }

    return { points, currencyFallback };
  }, [t0, cashFlows, partialCloses, allTrades, selectedCurrency, getSeriesData, stockPriceMap, missingSet, partialClosesByTrade]);

  return { data: result.points, t0, currencyFallback: result.currencyFallback };
}
