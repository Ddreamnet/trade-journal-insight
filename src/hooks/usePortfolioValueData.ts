import { useMemo, useEffect } from 'react';
import { Trade } from '@/types/trade';
import { PartialCloseRecord, calculateT0FromClosedTrades } from './useEquityCurveData';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { MarketAsset } from '@/types/market';
import { format, parseISO, startOfDay, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export type PortfolioCurrency = 'TL' | 'USD' | 'EUR' | 'gold';

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

export function usePortfolioValueData(
  closedTrades: Trade[],
  allTrades: Trade[],
  cashFlows: CashFlowInput[],
  partialCloses: PartialCloseRecord[],
  selectedCurrency: PortfolioCurrency
) {
  const { getSeriesData, fetchSeries } = useMarketSeries();

  // Fetch currency data if needed
  useEffect(() => {
    if (selectedCurrency === 'USD') fetchSeries('usd');
    else if (selectedCurrency === 'EUR') fetchSeries('eur');
    else if (selectedCurrency === 'gold') fetchSeries('gold');
  }, [selectedCurrency, fetchSeries]);

  const t0 = useMemo(
    () => calculateT0FromClosedTrades(closedTrades),
    [closedTrades]
  );

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
      // Store last event info for the day
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
        selectedCurrency === 'USD' ? 'usd' : selectedCurrency === 'EUR' ? 'eur' : 'gold';
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

      const valueTL = runningCash + runningPnL;

      // Currency conversion with carry-forward
      let value = valueTL;
      if (currencyMap) {
        const rate = currencyMap.get(key);
        if (rate !== undefined && rate > 0) lastCurrencyRate = rate;
        value = valueTL / lastCurrencyRate;
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
  }, [t0, cashFlows, partialCloses, allTrades, selectedCurrency, getSeriesData]);

  return { data: result.points, t0, currencyFallback: result.currencyFallback };
}
