import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { MarketStock, MarketDataResponse } from '@/types/market';
import { supabase } from '@/integrations/supabase/client';

interface MarketDataContextType {
  stocks: MarketStock[];
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  isFallback: boolean;
  refetch: () => Promise<void>;
  getStockBySymbol: (symbol: string) => MarketStock | undefined;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

const POLLING_INTERVAL = 60000; // 60 saniye
const CACHE_KEY = 'bist100_cache';

// LocalStorage'dan cache oku
const getCachedData = (): { stocks: MarketStock[]; updatedAt: string } | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
};

// LocalStorage'a cache yaz
const setCachedData = (stocks: MarketStock[], updatedAt: string) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ stocks, updatedAt }));
  } catch (e) {
    console.error('Cache write error:', e);
  }
};

// Hash-based comparison to prevent unnecessary re-renders
function stocksHash(stocks: MarketStock[]): string {
  return stocks.map(s => `${s.symbol}:${s.last}:${s.chgPct}`).join('|');
}

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [stocks, setStocks] = useState<MarketStock[]>(() => {
    const cached = getCachedData();
    return cached?.stocks || [];
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    const cached = getCachedData();
    return cached?.updatedAt || null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stocksHashRef = useRef<string>('');

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('bist100');
      
      if (fnError) {
        throw new Error(fnError.message);
      }

      const response = data as MarketDataResponse;

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.items && response.items.length > 0) {
        const newHash = stocksHash(response.items);
        // Only update state if data actually changed
        if (newHash !== stocksHashRef.current) {
          stocksHashRef.current = newHash;
          setStocks(response.items);
        }
        setLastUpdated(response.updatedAt);
        setIsFallback(false);
        setCachedData(response.items, response.updatedAt);
      }
    } catch (err) {
      console.error('Market data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Veri alınamadı');
      
      const cached = getCachedData();
      if (cached && cached.stocks.length > 0) {
        const newHash = stocksHash(cached.stocks);
        if (newHash !== stocksHashRef.current) {
          stocksHashRef.current = newHash;
          setStocks(cached.stocks);
        }
        setLastUpdated(cached.updatedAt);
        setIsFallback(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getStockBySymbol = useCallback((symbol: string): MarketStock | undefined => {
    return stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
  }, [stocks]);

  useEffect(() => {
    fetchMarketData();
    intervalRef.current = setInterval(() => {
      fetchMarketData();
    }, POLLING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchMarketData]);

  const value: MarketDataContextType = {
    stocks,
    lastUpdated,
    isLoading,
    error,
    isFallback,
    refetch: fetchMarketData,
    getStockBySymbol
  };

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (context === undefined) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
}
