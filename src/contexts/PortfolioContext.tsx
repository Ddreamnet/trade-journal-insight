import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolios } from '@/hooks/usePortfolios';
import { Portfolio, PortfolioFilter, PortfolioFilterMode } from '@/types/portfolio';

// İşlemlerim sayfasında "aktif" portföy seçimi.
// null  → kullanıcıya seçim zorunlu (create modal açılır); gerçekte seçim yapıldığında id döner.
// 'all' → tüm portföylerin birleşik görünümü (sadece liste için)
export type ActivePortfolioSelection = string | 'all' | null;

const ACTIVE_KEY_PREFIX = 'portfolio.active.';
const FILTER_KEY_PREFIX = 'portfolio.filter.';

interface PortfolioContextValue {
  portfolios: Portfolio[];
  activePortfolios: Portfolio[];
  closedPortfolios: Portfolio[];
  isLoading: boolean;

  /** İşlemlerim sayfası için aktif seçim (portföy id, 'all' veya null) */
  activeSelection: ActivePortfolioSelection;
  setActiveSelection: (sel: ActivePortfolioSelection) => void;

  /** Seçili tek portföy objesi ('all' veya null ise undefined) */
  activePortfolio: Portfolio | undefined;

  /** Raporlar sayfası filtresi */
  reportFilter: PortfolioFilter;
  setReportFilter: (f: PortfolioFilter) => void;

  /** Rapor filtresine göre efektif portföy ID listesi */
  reportPortfolioIds: string[];
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { portfolios, activePortfolios, closedPortfolios, isLoading } = usePortfolios();

  const activeKey = user ? ACTIVE_KEY_PREFIX + user.id : null;
  const filterKey = user ? FILTER_KEY_PREFIX + user.id : null;

  const [activeSelection, setActiveSelectionState] = useState<ActivePortfolioSelection>(null);
  const [reportFilter, setReportFilterState] = useState<PortfolioFilter>({
    mode: 'all',
    portfolioId: null,
  });

  // Kullanıcı değişince localStorage'tan seçimleri yükle
  useEffect(() => {
    if (!activeKey || !filterKey) return;
    setActiveSelectionState(readLS<ActivePortfolioSelection>(activeKey, null));
    setReportFilterState(readLS<PortfolioFilter>(filterKey, { mode: 'all', portfolioId: null }));
  }, [activeKey, filterKey]);

  // Portföyler geldikten sonra geçerli bir seçim yoksa ilk aktif portföyü seç
  useEffect(() => {
    if (isLoading || !activeKey) return;
    if (portfolios.length === 0) return;

    const isValid =
      activeSelection === 'all' ||
      (typeof activeSelection === 'string' && portfolios.some(p => p.id === activeSelection));

    if (!isValid) {
      const first = activePortfolios[0] ?? portfolios[0];
      const next: ActivePortfolioSelection = first ? first.id : null;
      setActiveSelectionState(next);
      writeLS(activeKey, next);
    }
  }, [isLoading, portfolios, activePortfolios, activeSelection, activeKey]);

  const setActiveSelection = (sel: ActivePortfolioSelection) => {
    setActiveSelectionState(sel);
    if (activeKey) writeLS(activeKey, sel);
  };

  const setReportFilter = (f: PortfolioFilter) => {
    // mode !== 'single' olduğunda portfolioId'yi temizle
    const normalized: PortfolioFilter = f.mode === 'single' ? f : { mode: f.mode, portfolioId: null };
    setReportFilterState(normalized);
    if (filterKey) writeLS(filterKey, normalized);
  };

  const activePortfolio = useMemo<Portfolio | undefined>(() => {
    if (typeof activeSelection !== 'string' || activeSelection === 'all') return undefined;
    return portfolios.find(p => p.id === activeSelection);
  }, [activeSelection, portfolios]);

  const reportPortfolioIds = useMemo(() => {
    switch (reportFilter.mode) {
      case 'single':
        return reportFilter.portfolioId ? [reportFilter.portfolioId] : [];
      case 'active':
        return activePortfolios.map(p => p.id);
      case 'closed':
        return closedPortfolios.map(p => p.id);
      case 'all':
      default:
        return portfolios.map(p => p.id);
    }
  }, [reportFilter, portfolios, activePortfolios, closedPortfolios]);

  const value: PortfolioContextValue = {
    portfolios,
    activePortfolios,
    closedPortfolios,
    isLoading,
    activeSelection,
    setActiveSelection,
    activePortfolio,
    reportFilter,
    setReportFilter,
    reportPortfolioIds,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolioContext(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolioContext must be used within a PortfolioProvider');
  return ctx;
}
