import { Trade } from '@/types/trade';
import { format, parseISO, startOfDay } from 'date-fns';

export interface PartialCloseRecord {
  id: string;
  trade_id: string;
  realized_pnl: number | null;
  lot_quantity: number;
  created_at: string;
}

/**
 * For a given trade, compute remaining_lot at a specific day
 * by subtracting partial closes that happened on or before that day
 */
export function getRemainingLotAtDay(
  trade: Trade,
  dayKey: string,
  tradePartialCloses: PartialCloseRecord[]
): number {
  let closed = 0;
  for (const pc of tradePartialCloses) {
    const pcKey = format(startOfDay(parseISO(pc.created_at)), 'yyyy-MM-dd');
    if (pcKey <= dayKey) {
      closed += pc.lot_quantity;
    }
  }
  return Math.max(0, trade.lot_quantity - closed);
}

/**
 * Linear interpolation fallback for trades without price data
 */
export function linearInterpolatePrice(
  entryPrice: number,
  exitPrice: number | null,
  openDate: Date,
  closeDate: Date | null,
  currentDay: Date
): number {
  if (!closeDate || !exitPrice) return entryPrice;

  const totalDays = Math.max(1, (closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, (currentDay.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24));
  const progress = Math.min(1, elapsedDays / totalDays);

  return entryPrice + (exitPrice - entryPrice) * progress;
}

/**
 * Group partial closes by trade_id for fast lookup
 */
export function groupPartialClosesByTrade(
  partialCloses: PartialCloseRecord[]
): Map<string, PartialCloseRecord[]> {
  const map = new Map<string, PartialCloseRecord[]>();
  for (const pc of partialCloses) {
    const existing = map.get(pc.trade_id) || [];
    existing.push(pc);
    map.set(pc.trade_id, existing);
  }
  return map;
}

/**
 * Calculate unrealized PnL for all trades open on a given day
 */
export function calculateUnrealizedPnL(
  allTrades: Trade[],
  currentDay: Date,
  dayKey: string,
  partialClosesByTrade: Map<string, PartialCloseRecord[]>,
  stockPriceMap: Map<string, Map<string, number>>,
  missingSet: Set<string>
): number {
  let unrealizedPnL = 0;

  for (const trade of allTrades) {
    const tradeOpen = startOfDay(parseISO(trade.created_at));
    const tradeClosed = trade.closed_at ? startOfDay(parseISO(trade.closed_at)) : null;

    // Is this trade open on this day?
    if (tradeOpen > currentDay) continue;
    if (tradeClosed && tradeClosed <= currentDay) continue;

    // Get remaining lot at this day
    const tradePC = partialClosesByTrade.get(trade.id) || [];
    const remainingLot = getRemainingLotAtDay(trade, dayKey, tradePC);
    if (remainingLot <= 0) continue;

    // Get current price
    let currentPrice: number;
    const symbolPrices = stockPriceMap.get(trade.stock_symbol);

    if (symbolPrices && symbolPrices.size > 0) {
      currentPrice = symbolPrices.get(dayKey) ?? trade.entry_price;
    } else if (missingSet.has(trade.stock_symbol)) {
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

  return unrealizedPnL;
}
