import { Trade, ClosedTradeEntry } from '@/types/trade';
import { getSymbolCurrency } from '@/lib/currency';

export interface MergedClosedTrade {
  key: string;
  portfolio_id: string;
  stock_symbol: string;
  stock_name: string;
  trade_type: 'buy' | 'sell';

  total_lot: number;
  weighted_entry: number;
  weighted_target: number;
  weighted_stop: number;
  weighted_exit: number;
  weighted_rr: number | null;
  total_realized_pnl: number;

  first_opened_at: string;
  last_closed_at: string;

  // Dominant closing type across partials; 'mixed' if hem kar hem stop varsa
  closing_type_dominant: 'kar_al' | 'stop' | 'mixed';

  partial_closes: ClosedTradeEntry[];
  source_trades: Trade[];
}

function weightedAvg(pairs: Array<{ value: number; weight: number }>): number {
  const totalWeight = pairs.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return 0;
  const sum = pairs.reduce((s, p) => s + p.value * p.weight, 0);
  return sum / totalWeight;
}

/**
 * Partial close'ları ve kaynak trade'leri (portfolio_id, symbol, trade_type) anahtarına göre gruplar.
 * Kullanıcının talebi: "kapalı işlemler kısmında aynı hisseye ait ve farklı zamanlarda kapatılan işlemler birleşsin".
 */
export function mergeClosedEntries(
  partialCloses: ClosedTradeEntry[],
  allTrades: Trade[]
): MergedClosedTrade[] {
  if (partialCloses.length === 0) return [];

  const groups = new Map<string, ClosedTradeEntry[]>();
  for (const pc of partialCloses) {
    const key = `${pc.portfolio_id}__${pc.stock_symbol}__${pc.trade_type}`;
    const list = groups.get(key) ?? [];
    list.push(pc);
    groups.set(key, list);
  }

  const result: MergedClosedTrade[] = [];

  for (const [key, entries] of groups) {
    // Kaynak trade'ler: bu partial close'ların parent trade_id'leri
    const tradeIds = new Set(entries.map((e) => e.trade_id));
    const sourceTrades = allTrades.filter((t) => tradeIds.has(t.id));

    // Ağırlıklandırma: lot_quantity bazında
    const lotPairs = (field: keyof ClosedTradeEntry) =>
      entries.map((e) => ({ value: Number(e[field] ?? 0), weight: e.lot_quantity }));

    const total_lot = entries.reduce((s, e) => s + e.lot_quantity, 0);
    const weighted_entry = weightedAvg(lotPairs('entry_price'));
    const weighted_target = weightedAvg(lotPairs('target_price'));
    const weighted_stop = weightedAvg(lotPairs('stop_price'));
    const weighted_exit = weightedAvg(lotPairs('exit_price'));
    const total_realized_pnl = entries.reduce((s, e) => s + (e.realized_pnl ?? 0), 0);

    // RR ağırlıklı (NULL olmayanlar üzerinden)
    const rrPairs = entries
      .filter((e) => e.rr_ratio !== null && e.rr_ratio !== undefined)
      .map((e) => ({ value: Number(e.rr_ratio), weight: e.lot_quantity }));
    const weighted_rr = rrPairs.length > 0 ? weightedAvg(rrPairs) : null;

    // Tarihler
    const sortedByCreate = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last_closed_at = sortedByCreate.at(-1)?.created_at ?? '';
    const first_opened_at = sourceTrades.length
      ? [...sourceTrades].sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at
      : last_closed_at;

    // Dominant closing type
    const hasKar = entries.some((e) => e.closing_type === 'kar_al');
    const hasStop = entries.some((e) => e.closing_type === 'stop');
    const closing_type_dominant: 'kar_al' | 'stop' | 'mixed' =
      hasKar && hasStop ? 'mixed' : hasKar ? 'kar_al' : 'stop';

    const first = entries[0];
    result.push({
      key,
      portfolio_id: first.portfolio_id,
      stock_symbol: first.stock_symbol,
      stock_name: first.stock_name,
      trade_type: first.trade_type,
      total_lot,
      weighted_entry,
      weighted_target,
      weighted_stop,
      weighted_exit,
      weighted_rr,
      total_realized_pnl,
      first_opened_at,
      last_closed_at,
      closing_type_dominant,
      partial_closes: sortedByCreate,
      source_trades: [...sourceTrades].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    });
  }

  // En son kapatılan en üstte
  return result.sort((a, b) => b.last_closed_at.localeCompare(a.last_closed_at));
}

/**
 * Bir trade için PnL'yi hem native currency'de hem de USD/TRY'ye çevirerek döner.
 * usdTryRate: 1 USD = X TRY. 0 ise dönüşüm yapılmaz (null döner).
 */
export interface PnLInCurrencies {
  native: number;
  currency: 'USD' | 'TRY';
  try: number | null;
  usd: number | null;
}

export function convertPnL(
  pnlNative: number,
  symbol: string,
  usdTryRate: number | null | undefined
): PnLInCurrencies {
  const currency = getSymbolCurrency(symbol);
  const rate = usdTryRate && usdTryRate > 0 ? usdTryRate : null;

  if (currency === 'TRY') {
    return {
      native: pnlNative,
      currency: 'TRY',
      try: pnlNative,
      usd: rate ? pnlNative / rate : null,
    };
  }

  // USD
  return {
    native: pnlNative,
    currency: 'USD',
    try: rate ? pnlNative * rate : null,
    usd: pnlNative,
  };
}

/**
 * Bir trade için kâr yüzdesini hesaplar.
 * Buy: (exit - entry) / entry
 * Sell: (entry - exit) / entry
 */
export function calculateProfitPct(
  tradeType: 'buy' | 'sell',
  entryPrice: number,
  exitPrice: number
): number {
  if (entryPrice === 0) return 0;
  if (tradeType === 'buy') {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  }
  return ((entryPrice - exitPrice) / entryPrice) * 100;
}

/**
 * Aktif bir trade ile yeni bir alım/satımı birleştirirken yeni ağırlıklı
 * entry/target/stop ve toplam lotu döner. UI katmanı bunu kullanarak
 * önizleme gösterebilir; persist işlemi hook/RPC katmanında yapılır.
 */
export interface MergeActivePreview {
  newEntry: number;
  newTarget: number;
  newStop: number;
  newLot: number;
}

export function previewMergeActive(
  existing: Pick<Trade, 'entry_price' | 'target_price' | 'stop_price' | 'lot_quantity'>,
  incoming: { entry_price: number; target_price: number; stop_price: number; lot_quantity: number }
): MergeActivePreview {
  const wA = Math.max(existing.lot_quantity, 0);
  const wB = Math.max(incoming.lot_quantity, 0);
  const totalW = wA + wB;
  if (totalW === 0) {
    return {
      newEntry: incoming.entry_price,
      newTarget: incoming.target_price,
      newStop: incoming.stop_price,
      newLot: 0,
    };
  }

  const avg = (a: number, b: number) => (a * wA + b * wB) / totalW;

  return {
    newEntry: avg(existing.entry_price, incoming.entry_price),
    newTarget: avg(existing.target_price, incoming.target_price),
    newStop: avg(existing.stop_price, incoming.stop_price),
    newLot: totalW,
  };
}
