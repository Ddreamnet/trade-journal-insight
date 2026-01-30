// Portfolio Event Types
export type PortfolioEventType = 'deposit' | 'withdraw' | 'pnl';

export interface PortfolioEvent {
  id: string;
  user_id: string;
  event_type: PortfolioEventType;
  amount_tl: number;
  trade_id: string | null;
  note: string | null;
  created_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  user_id: string;
  event_id: string;
  snapshot_date: string;
  shares_total: number;
  unit_price: number;
  portfolio_value: number;
  created_at: string;
}

// Chart Data Types for Relative Baseline
export interface RelativeChartPoint {
  date: string;
  rawDate: string;
  portfolioReturnPct: number;
  // Benchmark relative differences (asset_return - portfolio_return)
  gold?: number;
  usd?: number;
  eur?: number;
  bist100?: number;
  nasdaq100?: number;
  inflation_tr?: number;
  // Index signature for dynamic benchmark access
  [key: string]: string | number | undefined;
}

// Current portfolio state
export interface PortfolioState {
  sharesTotal: number;
  unitPrice: number;
  portfolioValue: number;
  latestDate: string | null;
}

// Panel display data
export interface CurrentValueData {
  date: string;
  unitPrice: number;
  portfolioReturnPct: number;
  benchmarkDiffs: Record<string, number>;
  inflationText: string | null; // "100 TL → X TL" format
}
