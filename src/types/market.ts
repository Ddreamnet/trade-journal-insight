export interface MarketStock {
  symbol: string;
  last: number;
  low: number;
  high: number;
  chg: number;
  chgPct: number;
  time: string;
  logoUrl?: string;
  /** Para birimi: TRY = Türk lirası (BIST), USD = Dolar (kripto/emtia) */
  currency?: 'TRY' | 'USD';
  /** Okunabilir ad (ör. "Bitcoin", "Altın (oz/USD)") */
  name?: string;
}

export interface MarketDataResponse {
  updatedAt: string;
  source: string;
  items: MarketStock[];
  error?: string;
}

// Market Series Types for Historical Data
export type MarketAsset = 'gold' | 'silver' | 'usd' | 'eur' | 'bist100' | 'nasdaq100' | 'inflation_tr' | 'btcusdt';

export interface MarketSeriesPoint {
  date: string; // YYYY-MM-DD
  value: number; // Close price or percentage
}

export interface MarketSeriesData {
  asset: MarketAsset;
  updatedAt: string;
  points: MarketSeriesPoint[];
  source?: string;
}

export const ASSET_LABELS: Record<MarketAsset, string> = {
  gold: 'Altın',
  silver: 'Gümüş',
  usd: 'Dolar',
  eur: 'Euro',
  bist100: 'BIST 100',
  nasdaq100: 'NASDAQ 100',
  inflation_tr: 'Enflasyon (TR)',
  btcusdt: 'Bitcoin',
};
