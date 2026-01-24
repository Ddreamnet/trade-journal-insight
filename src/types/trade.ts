export interface Stock {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
}

export type TradeType = 'buy' | 'sell';

export type TradeReason = 
  | '14_ma_ustu'
  | '22_ma_ustu'
  | '50_ma_ustu'
  | '100_ma_ustu'
  | '200_ma_ustu'
  | 'yatay_trend_kirilimi'
  | 'yukselen_trend_kirilimi'
  | 'dusen_trend_kirilimi'
  | 'hacim_artisi'
  | 'takas_toplu';

export interface TradeReasonOption {
  id: TradeReason;
  label: string;
}

export const TRADE_REASONS: TradeReasonOption[] = [
  { id: '14_ma_ustu', label: '14 MA Üstü' },
  { id: '22_ma_ustu', label: '22 MA Üstü' },
  { id: '50_ma_ustu', label: '50 MA Üstü' },
  { id: '100_ma_ustu', label: '100 MA Üstü' },
  { id: '200_ma_ustu', label: '200 MA Üstü' },
  { id: 'yatay_trend_kirilimi', label: 'Yatay Trend Kırılımı' },
  { id: 'yukselen_trend_kirilimi', label: 'Yükselen Trend Kırılımı' },
  { id: 'dusen_trend_kirilimi', label: 'Düşen Trend Kırılımı' },
  { id: 'hacim_artisi', label: 'Hacim Artışı' },
  { id: 'takas_toplu', label: 'Takas Toplu' },
];

export interface Trade {
  id: string;
  stock_id: string;
  stock_symbol: string;
  stock_name: string;
  trade_type: TradeType;
  entry_price: number;
  target_price: number;
  stop_price: number;
  exit_price?: number;
  rr_ratio: number;
  reasons: TradeReason[];
  status: 'active' | 'closed';
  result?: 'success' | 'failure';
  progress_percent?: number;
  created_at: string;
  closed_at?: string;
  current_price?: number;
}

export interface BenchmarkData {
  id: string;
  name: string;
  symbol: string;
  color: string;
}

export const BENCHMARKS: BenchmarkData[] = [
  { id: 'gold', name: 'Altın', symbol: 'XAU', color: '#FFD700' },
  { id: 'usd', name: 'Dolar', symbol: 'USD', color: '#85BB65' },
  { id: 'eur', name: 'Euro', symbol: 'EUR', color: '#0052B4' },
  { id: 'bist100', name: 'BIST 100', symbol: 'XU100', color: '#E30A17' },
  { id: 'nasdaq', name: 'NASDAQ 100', symbol: 'NDX', color: '#00AAFF' },
];

export type TimeRange = '1w' | '1m' | '3m' | '6m' | '1y';

export interface TimeRangeOption {
  id: TimeRange;
  label: string;
}

export const TIME_RANGES: TimeRangeOption[] = [
  { id: '1w', label: '1 Hafta' },
  { id: '1m', label: '1 Ay' },
  { id: '3m', label: '3 Ay' },
  { id: '6m', label: '6 Ay' },
  { id: '1y', label: '1 Sene' },
];
