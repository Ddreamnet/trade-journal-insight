import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { MarketAsset, MarketSeriesData, MarketSeriesPoint } from '@/types/market';
import { subDays, subMonths, parseISO, isAfter } from 'date-fns';
import { TimeRange } from '@/types/trade';

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

// Edge function URL
const API_URL = 'https://pjqbpkblutbdpfzzwxmr.supabase.co/functions/v1/market-series';
// Fallback to cPanel PHP endpoint if edge function fails
const PHP_API_URL = '/api/market-series.php';

// Hardcoded inflation data as ultimate fallback (EVDS may have IP restrictions)
// Source: TÜİK TÜFE monthly percent change (month-over-month)
const FALLBACK_INFLATION_DATA: MarketSeriesPoint[] = [
  // 2023
  { date: '2023-01-01', value: 6.65 },
  { date: '2023-02-01', value: 3.15 },
  { date: '2023-03-01', value: 2.29 },
  { date: '2023-04-01', value: 2.39 },
  { date: '2023-05-01', value: 0.04 },
  { date: '2023-06-01', value: 3.92 },
  { date: '2023-07-01', value: 9.49 },
  { date: '2023-08-01', value: 9.09 },
  { date: '2023-09-01', value: 4.75 },
  { date: '2023-10-01', value: 3.43 },
  { date: '2023-11-01', value: 3.28 },
  { date: '2023-12-01', value: 2.93 },
  // 2024
  { date: '2024-01-01', value: 6.70 },
  { date: '2024-02-01', value: 4.53 },
  { date: '2024-03-01', value: 3.16 },
  { date: '2024-04-01', value: 3.18 },
  { date: '2024-05-01', value: 3.37 },
  { date: '2024-06-01', value: 1.64 },
  { date: '2024-07-01', value: 3.23 },
  { date: '2024-08-01', value: 2.47 },
  { date: '2024-09-01', value: 2.97 },
  { date: '2024-10-01', value: 2.88 },
  { date: '2024-11-01', value: 2.24 },
  { date: '2024-12-01', value: 1.03 },
  // 2025 (TÜİK resmi verileri)
  { date: '2025-01-01', value: 5.25 },
  { date: '2025-02-01', value: 2.27 },
  { date: '2025-03-01', value: 2.46 },
  { date: '2025-04-01', value: 3.00 },
  { date: '2025-05-01', value: 2.10 },
  { date: '2025-06-01', value: 1.87 },
  { date: '2025-07-01', value: 2.43 },
  { date: '2025-08-01', value: 2.54 },
  { date: '2025-09-01', value: 2.61 },
  { date: '2025-10-01', value: 2.83 },
  { date: '2025-11-01', value: 2.22 },
  { date: '2025-12-01', value: 1.55 },
  // 2026
  { date: '2026-01-01', value: 3.85 },
];

interface CacheEntry {
  data: MarketSeriesData;
  timestamp: number;
}

interface StoredCache {
  [asset: string]: CacheEntry;
}

export function MarketSeriesProvider({ children }: { children: React.ReactNode }) {
  const [seriesData, setSeriesData] = useState<Record<string, MarketSeriesData>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const cache: StoredCache = JSON.parse(stored);
        const now = Date.now();
        const validData: Record<string, MarketSeriesData> = {};

        for (const [asset, entry] of Object.entries(cache)) {
          // Skip expired entries
          if (now - entry.timestamp >= CACHE_DURATION_MS) {
            continue;
          }
          // Skip entries with empty points (force refetch)
          if (!entry.data.points || entry.data.points.length === 0) {
            console.warn(`Skipping cached ${asset} - has empty points`);
            continue;
          }
          validData[asset] = entry.data;
        }

        if (Object.keys(validData).length > 0) {
          setSeriesData(validData);
        }
      }
    } catch (e) {
      console.error('Failed to load market series cache:', e);
    }
  }, []);

  // Save to localStorage on data change
  useEffect(() => {
    if (Object.keys(seriesData).length > 0) {
      const cache: StoredCache = {};
      const now = Date.now();

      for (const [asset, data] of Object.entries(seriesData)) {
        cache[asset] = { data, timestamp: now };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    }
  }, [seriesData]);

  const fetchSeries = useCallback(async (asset: MarketAsset) => {
    // Prevent duplicate fetches
    if (fetchingRef.current.has(asset)) {
      return;
    }

    // Check if we have fresh cached data
    const existing = seriesData[asset];
    if (existing) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const cache: StoredCache = JSON.parse(stored);
          const entry = cache[asset];
          if (entry && Date.now() - entry.timestamp < CACHE_DURATION_MS) {
            return; // Data is still fresh
          }
        }
      } catch (e) {
        // Continue with fetch
      }
    }

    fetchingRef.current.add(asset);
    setLoadingStates((prev) => ({ ...prev, [asset]: true }));
    setErrorStates((prev) => ({ ...prev, [asset]: null }));

    try {
      let data: MarketSeriesData | null = null;
      
      // Try Edge Function first
      try {
        const response = await fetch(`${API_URL}?asset=${asset}`);
        if (response.ok) {
          const json = await response.json();
          // Only accept data if it has actual points
          if (json.points && json.points.length > 0) {
            data = json;
          } else {
            console.warn(`Edge function returned empty data for ${asset}`);
          }
        }
      } catch (edgeError) {
        console.warn(`Edge function failed for ${asset}, trying PHP fallback:`, edgeError);
      }

      // Try PHP fallback if Edge failed or returned empty
      if (!data) {
        try {
          const phpResponse = await fetch(`${PHP_API_URL}?asset=${asset}`);
          if (phpResponse.ok) {
            const phpJson = await phpResponse.json();
            // Only accept data if it has actual points
            if (phpJson.points && phpJson.points.length > 0) {
              data = phpJson;
            } else {
              console.warn(`PHP fallback returned empty data for ${asset}`);
            }
          }
        } catch (phpError) {
          console.warn(`PHP fallback failed for ${asset}:`, phpError);
        }
      }

      // Use hardcoded fallback for inflation if both APIs failed or returned empty
      if (!data && asset === 'inflation_tr') {
        console.warn('Using hardcoded fallback data for inflation_tr');
        data = {
          asset: 'inflation_tr',
          updatedAt: new Date().toISOString(),
          points: FALLBACK_INFLATION_DATA,
          source: 'TÜİK (Fallback)',
        };
      }

      if (data) {
        setSeriesData((prev) => ({ ...prev, [asset]: data! }));
      } else {
        throw new Error('All data sources failed');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Veri alınamadı';
      console.error(`Failed to fetch ${asset} series:`, e);
      setErrorStates((prev) => ({ ...prev, [asset]: errorMessage }));
    } finally {
      fetchingRef.current.delete(asset);
      setLoadingStates((prev) => ({ ...prev, [asset]: false }));
    }
  }, [seriesData]);

  const getSeriesData = useCallback(
    (asset: MarketAsset) => seriesData[asset] || null,
    [seriesData]
  );

  const isLoading = useCallback(
    (asset: MarketAsset) => loadingStates[asset] || false,
    [loadingStates]
  );

  const error = useCallback(
    (asset: MarketAsset) => errorStates[asset] || null,
    [errorStates]
  );

  // Filter points by time range (client-side)
  const filterByTimeRange = useCallback(
    (points: MarketSeriesPoint[], timeRange: TimeRange): MarketSeriesPoint[] => {
      if (!points || points.length === 0) return [];

      const now = new Date();
      let cutoffDate: Date;

      switch (timeRange) {
        case '1m':
          cutoffDate = subMonths(now, 1);
          break;
        case '3m':
          cutoffDate = subMonths(now, 3);
          break;
        case '1y':
          cutoffDate = subMonths(now, 12);
          break;
        case 'ytd':
          cutoffDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
          break;
        default:
          cutoffDate = subMonths(now, 1);
      }

      return points.filter((point) => {
        const pointDate = parseISO(point.date);
        return isAfter(pointDate, cutoffDate);
      });
    },
    []
  );

  // Normalize data to start from 100
  const normalizeData = useCallback(
    (points: MarketSeriesPoint[]): MarketSeriesPoint[] => {
      if (!points || points.length === 0) return [];

      const firstValue = points[0].value;
      if (firstValue === 0) return points;

      return points.map((point) => ({
        date: point.date,
        value: parseFloat(((point.value / firstValue) * 100).toFixed(2)),
      }));
    },
    []
  );

  return (
    <MarketSeriesContext.Provider
      value={{
        getSeriesData,
        fetchSeries,
        isLoading,
        error,
        filterByTimeRange,
        normalizeData,
      }}
    >
      {children}
    </MarketSeriesContext.Provider>
  );
}

export function useMarketSeries() {
  const context = useContext(MarketSeriesContext);
  if (!context) {
    throw new Error('useMarketSeries must be used within MarketSeriesProvider');
  }
  return context;
}
