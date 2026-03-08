import { TRADE_REASONS, STOP_REASONS } from '@/types/trade';

/**
 * Get comma-separated reason labels from reason IDs
 */
export function getReasonLabels(reasonIds: string[]): string {
  return reasonIds
    .map((id) => TRADE_REASONS.find((r) => r.id === id)?.label || id)
    .join(', ');
}

/**
 * Get array of reason labels from reason IDs
 */
export function getReasonLabelsList(reasonIds: string[]): string[] {
  return reasonIds.map((id) => TRADE_REASONS.find((r) => r.id === id)?.label || id);
}

/**
 * Get stop reason labels from comma-separated stop reason IDs
 */
export function getStopReasonLabels(stopReasonIds: string | null): string | null {
  if (!stopReasonIds) return null;
  return stopReasonIds
    .split(',')
    .map((id) => STOP_REASONS.find((r) => r.id === id)?.label || id)
    .join(', ');
}

/**
 * Calculate RR based on exit price for closed trades
 */
export function getClosedRR(trade: {
  trade_type: string;
  entry_price: number;
  exit_price?: number | null;
  stop_price: number;
}): number | null {
  if (!trade.exit_price) return null;
  const reward =
    trade.trade_type === 'buy'
      ? trade.exit_price - trade.entry_price
      : trade.entry_price - trade.exit_price;
  const risk =
    trade.trade_type === 'buy'
      ? trade.entry_price - trade.stop_price
      : trade.stop_price - trade.entry_price;
  if (risk <= 0) return null;
  return Math.round((reward / risk) * 100) / 100;
}
