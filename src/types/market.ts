export interface MarketStock {
  symbol: string;
  last: number;
  low: number;
  high: number;
  chg: number;
  chgPct: number;
  time: string;
  logoUrl?: string;
}

export interface MarketDataResponse {
  updatedAt: string;
  source: string;
  items: MarketStock[];
  error?: string;
}

// Market Series Types for Historical Data
export type MarketAsset = 'gold' | 'usd' | 'eur' | 'bist100' | 'nasdaq100';

export interface MarketSeriesPoint {
  date: string; // YYYY-MM-DD
  value: number; // Close price
}

export interface MarketSeriesData {
  asset: MarketAsset;
  updatedAt: string;
  points: MarketSeriesPoint[];
}

export const ASSET_LABELS: Record<MarketAsset, string> = {
  gold: 'Altın',
  usd: 'Dolar',
  eur: 'Euro',
  bist100: 'BIST 100',
  nasdaq100: 'NASDAQ 100',
};
