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
          if (now - entry.timestamp < CACHE_DURATION_MS) {
            validData[asset] = entry.data;
          }
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
      const response = await fetch(`${API_URL}?asset=${asset}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: MarketSeriesData = await response.json();

      setSeriesData((prev) => ({ ...prev, [asset]: data }));
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
        case '1w':
          cutoffDate = subDays(now, 7);
          break;
        case '1m':
          cutoffDate = subMonths(now, 1);
          break;
        case '3m':
          cutoffDate = subMonths(now, 3);
          break;
        case '6m':
          cutoffDate = subMonths(now, 6);
          break;
        case '1y':
          cutoffDate = subMonths(now, 12);
          break;
        case '3y':
          cutoffDate = subMonths(now, 36);
          break;
        default:
          cutoffDate = subMonths(now, 12); // Default to 1 year
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
