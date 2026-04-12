import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { MarketAsset, MarketSeriesData, MarketSeriesPoint } from '@/types/market';
import { subMonths, parseISO, isAfter } from 'date-fns';
import { TimeRange } from '@/types/trade';
import { supabase } from '@/integrations/supabase/client';

interface MarketSeriesContextType {
  getSeriesData: (asset: MarketAsset) => MarketSeriesData | null;
  fetchSeries: (asset: MarketAsset) => Promise<void>;
  isLoading: (asset: MarketAsset) => boolean;
  error: (asset: MarketAsset) => string | null;
  filterByTimeRange: (points: MarketSeriesPoint[], timeRange: TimeRange) => MarketSeriesPoint[];
  normalizeData: (points: MarketSeriesPoint[]) => MarketSeriesPoint[];
}

const MarketSeriesContext = createContext<MarketSeriesContextType | null>(null);

const STORAGE_KEY = 'market-series-cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Hardcoded inflation fallback (TÜİK TÜFE monthly % change)
const FALLBACK_INFLATION_DATA: MarketSeriesPoint[] = [
  { date: '2023-01-01', value: 6.65 }, { date: '2023-02-01', value: 3.15 },
  { date: '2023-03-01', value: 2.29 }, { date: '2023-04-01', value: 2.39 },
  { date: '2023-05-01', value: 0.04 }, { date: '2023-06-01', value: 3.92 },
  { date: '2023-07-01', value: 9.49 }, { date: '2023-08-01', value: 9.09 },
  { date: '2023-09-01', value: 4.75 }, { date: '2023-10-01', value: 3.43 },
  { date: '2023-11-01', value: 3.28 }, { date: '2023-12-01', value: 2.93 },
  { date: '2024-01-01', value: 6.70 }, { date: '2024-02-01', value: 4.53 },
  { date: '2024-03-01', value: 3.16 }, { date: '2024-04-01', value: 3.18 },
  { date: '2024-05-01', value: 3.37 }, { date: '2024-06-01', value: 1.64 },
  { date: '2024-07-01', value: 3.23 }, { date: '2024-08-01', value: 2.47 },
  { date: '2024-09-01', value: 2.97 }, { date: '2024-10-01', value: 2.88 },
  { date: '2024-11-01', value: 2.24 }, { date: '2024-12-01', value: 1.03 },
  { date: '2025-01-01', value: 5.25 }, { date: '2025-02-01', value: 2.27 },
  { date: '2025-03-01', value: 2.46 }, { date: '2025-04-01', value: 3.00 },
  { date: '2025-05-01', value: 1.47 }, { date: '2025-06-01', value: 1.87 },
  { date: '2025-07-01', value: 1.29 }, { date: '2025-08-01', value: 2.48 },
  { date: '2025-09-01', value: 2.18 }, { date: '2025-10-01', value: 1.92 },
  { date: '2025-11-01', value: 1.63 }, { date: '2025-12-01', value: 1.24 },
  { date: '2026-01-01', value: 3.50 },
];

interface CacheEntry { data: MarketSeriesData; timestamp: number; }
interface StoredCache { [asset: string]: CacheEntry; }

export function MarketSeriesProvider({ children }: { children: React.ReactNode }) {
  const [seriesData, setSeriesData] = useState<Record<string, MarketSeriesData>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  // Use ref to avoid stale closures — fetchSeries won't re-create on every seriesData change
  const seriesDataRef = useRef(seriesData);
  seriesDataRef.current = seriesData;

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const cache: StoredCache = JSON.parse(stored);
      const now = Date.now();
      const validData: Record<string, MarketSeriesData> = {};
      for (const [asset, entry] of Object.entries(cache)) {
        if (now - entry.timestamp >= CACHE_DURATION_MS) continue;
        if (!entry.data.points || entry.data.points.length === 0) continue;
        validData[asset] = entry.data;
      }
      if (Object.keys(validData).length > 0) setSeriesData(validData);
    } catch (e) { console.error('Cache load error:', e); }
  }, []);

  // Save to localStorage on data change
  useEffect(() => {
    if (Object.keys(seriesData).length === 0) return;
    const cache: StoredCache = {};
    const now = Date.now();
    for (const [asset, data] of Object.entries(seriesData)) {
      cache[asset] = { data, timestamp: now };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }, [seriesData]);

  const fetchSeries = useCallback(async (asset: MarketAsset) => {
    // Prevent duplicate fetches
    if (fetchingRef.current.has(asset)) return;

    // Check if we have fresh cached data (use ref to avoid stale closure)
    const existing = seriesDataRef.current[asset];
    if (existing) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const cache: StoredCache = JSON.parse(stored);
          const entry = cache[asset];
          if (entry && Date.now() - entry.timestamp < CACHE_DURATION_MS) return;
        }
      } catch { /* continue */ }
    }

    fetchingRef.current.add(asset);
    setLoadingStates(prev => ({ ...prev, [asset]: true }));
    setErrorStates(prev => ({ ...prev, [asset]: null }));

    try {
      let data: MarketSeriesData | null = null;

      // Use supabase.functions.invoke() — handles auth headers automatically
      const { data: fnData, error: fnError } = await supabase.functions.invoke('market-series', {
        body: { asset },
      });

      if (!fnError && fnData?.points?.length > 0) {
        data = fnData as MarketSeriesData;
      } else {
        console.warn(`[MarketSeries] Edge fn failed for ${asset}:`, fnError?.message || 'empty data');
      }

      // Inflation fallback
      if (!data && asset === 'inflation_tr') {
        console.warn('[MarketSeries] Using hardcoded inflation fallback');
        data = {
          asset: 'inflation_tr',
          updatedAt: new Date().toISOString(),
          points: FALLBACK_INFLATION_DATA,
          source: 'TÜİK (Fallback)',
        };
      }

      if (data) {
        setSeriesData(prev => ({ ...prev, [asset]: data! }));
      } else {
        throw new Error('Veri kaynağı yanıt vermedi');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Veri alınamadı';
      console.error(`[MarketSeries] Failed ${asset}:`, e);
      setErrorStates(prev => ({ ...prev, [asset]: msg }));
    } finally {
      fetchingRef.current.delete(asset);
      setLoadingStates(prev => ({ ...prev, [asset]: false }));
    }
  }, []); // No dependency on seriesData — uses ref instead

  const getSeriesData = useCallback((asset: MarketAsset) => seriesData[asset] || null, [seriesData]);
  const isLoading = useCallback((asset: MarketAsset) => loadingStates[asset] || false, [loadingStates]);
  const error = useCallback((asset: MarketAsset) => errorStates[asset] || null, [errorStates]);

  // Filter points by time range
  const filterByTimeRange = useCallback((points: MarketSeriesPoint[], timeRange: TimeRange): MarketSeriesPoint[] => {
    if (!points || points.length === 0) return [];
    const now = new Date();
    let cutoff: Date;
    switch (timeRange) {
      case '1m': cutoff = subMonths(now, 1); break;
      case '3m': cutoff = subMonths(now, 3); break;
      case '6m': cutoff = subMonths(now, 6); break;
      case '1y': cutoff = subMonths(now, 12); break;
      case '3y': cutoff = subMonths(now, 36); break;
      default: cutoff = subMonths(now, 12);
    }
    return points.filter(p => isAfter(parseISO(p.date), cutoff));
  }, []);

  // Normalize to start from 100
  const normalizeData = useCallback((points: MarketSeriesPoint[]): MarketSeriesPoint[] => {
    if (!points || points.length === 0) return [];
    const first = points[0].value;
    if (first === 0) return points;
    return points.map(p => ({ date: p.date, value: parseFloat(((p.value / first) * 100).toFixed(2)) }));
  }, []);

  return (
    <MarketSeriesContext.Provider value={{ getSeriesData, fetchSeries, isLoading, error, filterByTimeRange, normalizeData }}>
      {children}
    </MarketSeriesContext.Provider>
  );
}

export function useMarketSeries() {
  const context = useContext(MarketSeriesContext);
  if (!context) throw new Error('useMarketSeries must be used within MarketSeriesProvider');
  return context;
}
