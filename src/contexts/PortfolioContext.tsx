import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolios } from '@/hooks/usePortfolios';
import { Portfolio } from '@/types/portfolio';

// Global portfolio selection used everywhere (İşlemler list filter, Ana
// Sayfa scoping, Rapor charts, etc.).
// - null  → user hasn't chosen yet; components may prompt via modal.
// - 'all' → combined view across every portfolio.
// - id    → a specific portfolio.
export type ActivePortfolioSelection = string | 'all' | null;

const ACTIVE_KEY_PREFIX = 'portfolio.active.';

interface PortfolioContextValue {
  portfolios: Portfolio[];
  activePortfolios: Portfolio[];
  closedPortfolios: Portfolio[];
  isLoading: boolean;

  /** Global selection controlling every portfolio-scoped surface. */
  activeSelection: ActivePortfolioSelection;
  setActiveSelection: (sel: ActivePortfolioSelection) => void;

  /** The resolved single portfolio object, undefined for 'all' / null. */
  activePortfolio: Portfolio | undefined;
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

  const [activeSelection, setActiveSelectionState] = useState<ActivePortfolioSelection>(null);

  // Hydrate selection from localStorage when the user changes.
  useEffect(() => {
    if (!activeKey) return;
    setActiveSelectionState(readLS<ActivePortfolioSelection>(activeKey, null));
  }, [activeKey]);

  // If the stored selection is no longer valid (portfolio deleted, etc.),
  // fall back to the first active portfolio (or the first overall).
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

  const activePortfolio = useMemo<Portfolio | undefined>(() => {
    if (typeof activeSelection !== 'string' || activeSelection === 'all') return undefined;
    return portfolios.find(p => p.id === activeSelection);
  }, [activeSelection, portfolios]);

  const value: PortfolioContextValue = {
    portfolios,
    activePortfolios,
    closedPortfolios,
    isLoading,
    activeSelection,
    setActiveSelection,
    activePortfolio,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolioContext(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolioContext must be used within a PortfolioProvider');
  return ctx;
}
