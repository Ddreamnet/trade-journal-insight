export type PortfolioStatus = 'active' | 'closed';

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  status: PortfolioStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}
