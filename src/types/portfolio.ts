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

// Reports sayfası için portföy filtresi:
// - single: tek portföy
// - active: tüm aktif portföyler
// - closed: tüm kapalı portföyler
// - all: tümü
export type PortfolioFilterMode = 'single' | 'active' | 'closed' | 'all';

export interface PortfolioFilter {
  mode: PortfolioFilterMode;
  portfolioId: string | null; // mode === 'single' olduğunda geçerli
}
