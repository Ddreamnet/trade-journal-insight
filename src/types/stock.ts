export interface BistStock {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number | null;
  time: string | null;
}

export interface BistApiResponse {
  stocks: BistStock[];
  lastUpdated: string;
  error?: string;
}
