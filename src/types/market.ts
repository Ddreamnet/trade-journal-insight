export interface MarketStock {
  symbol: string;
  last: number;
  low: number;
  high: number;
  chg: number;
  chgPct: number;
  time: string;
}

export interface MarketDataResponse {
  updatedAt: string;
  source: string;
  items: MarketStock[];
  error?: string;
}
