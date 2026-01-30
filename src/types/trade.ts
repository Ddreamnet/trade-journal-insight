import { MarketAsset } from './market';

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

// Stop reasons for closing trades
export type StopReason =
  | '14ma_ustu_kapanis'
  | '14ma_alti_kapanis'
  | '22ma_ustu_kapanis'
  | '22ma_alti_kapanis'
  | '50ma_ustu_kapanis'
  | '50ma_alti_kapanis'
  | '100ma_ustu_kapanis'
  | '100ma_alti_kapanis'
  | '200ma_ustu_kapanis'
  | '200ma_alti_kapanis'
  | 'yukselen_trend_asagi_kirilimi'
  | 'dusen_trend_yukari_kirilimi'
  | 'yatay_trend_yukari_kirilimi'
  | 'yatay_trend_asagi_kirilimi'
  | 'takas_toplu'
  | 'takas_bozulmus'
  | 'hacim_artisi'
  | 'hacim_azalisi';

export interface StopReasonOption {
  id: StopReason;
  label: string;
}

export const STOP_REASONS: StopReasonOption[] = [
  { id: '14ma_ustu_kapanis', label: '14 MA Üstü Kapanış' },
  { id: '14ma_alti_kapanis', label: '14 MA Altı Kapanış' },
  { id: '22ma_ustu_kapanis', label: '22 MA Üstü Kapanış' },
  { id: '22ma_alti_kapanis', label: '22 MA Altı Kapanış' },
  { id: '50ma_ustu_kapanis', label: '50 MA Üstü Kapanış' },
  { id: '50ma_alti_kapanis', label: '50 MA Altı Kapanış' },
  { id: '100ma_ustu_kapanis', label: '100 MA Üstü Kapanış' },
  { id: '100ma_alti_kapanis', label: '100 MA Altı Kapanış' },
  { id: '200ma_ustu_kapanis', label: '200 MA Üstü Kapanış' },
  { id: '200ma_alti_kapanis', label: '200 MA Altı Kapanış' },
  { id: 'yukselen_trend_asagi_kirilimi', label: 'Yükselen Trend Aşağı Kırılımı' },
  { id: 'dusen_trend_yukari_kirilimi', label: 'Düşen Trend Yukarı Kırılımı' },
  { id: 'yatay_trend_yukari_kirilimi', label: 'Yatay Trend Yukarı Kırılımı' },
  { id: 'yatay_trend_asagi_kirilimi', label: 'Yatay Trend Aşağı Kırılımı' },
  { id: 'takas_toplu', label: 'Takas Toplu' },
  { id: 'takas_bozulmus', label: 'Takas Bozulmuş' },
  { id: 'hacim_artisi', label: 'Hacim Artışı' },
  { id: 'hacim_azalisi', label: 'Hacim Azalışı' },
];

export type ClosingType = 'kar_al' | 'stop';

// Trade interface aligned with database schema
export interface Trade {
  id: string;
  user_id: string;
  stock_symbol: string;
  stock_name: string;
  trade_type: 'buy' | 'sell';
  entry_price: number;
  target_price: number;
  stop_price: number;
  reasons: string[];
  rr_ratio: number | null;
  status: 'active' | 'closed';
  exit_price: number | null;
  progress_percent: number | null;
  is_successful: boolean | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closing_note: string | null;
  position_amount: number | null;
  closing_type: ClosingType | null;
  stop_reason: string | null;
}

export interface BenchmarkData {
  id: MarketAsset;
  name: string;
  symbol: string;
  color: string;
}

export const BENCHMARKS: BenchmarkData[] = [
  { id: 'gold', name: 'Altın', symbol: 'XAU', color: '#FFD700' },
  { id: 'usd', name: 'Dolar', symbol: 'USD', color: '#85BB65' },
  { id: 'eur', name: 'Euro', symbol: 'EUR', color: '#0052B4' },
  { id: 'bist100', name: 'BIST 100', symbol: 'XU100', color: '#E30A17' },
  { id: 'nasdaq100', name: 'NASDAQ 100', symbol: 'NDX', color: '#00AAFF' },
  { id: 'inflation_tr', name: 'Enflasyon (TR)', symbol: 'TÜFE', color: '#FF6B35' },
];

export type TimeRange = '1m' | '3m' | '1y' | 'ytd';

export interface TimeRangeOption {
  id: TimeRange;
  label: string;
}

export const TIME_RANGES: TimeRangeOption[] = [
  { id: '1m', label: '1A' },
  { id: '3m', label: '3A' },
  { id: '1y', label: '1Y' },
  { id: 'ytd', label: 'YB' },
];
