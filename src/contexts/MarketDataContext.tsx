import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MarketStock, MarketDataResponse } from '@/types/market';
import { supabase } from '@/integrations/supabase/client';

export interface IndexData {
  last: number;
  chgPct: number;
}

interface MarketDataContextType {
  stocks: MarketStock[];
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  isFallback: boolean;
  refetch: () => Promise<void>;
  getStockBySymbol: (symbol: string) => MarketStock | undefined;
  xu100: IndexData | null;
  xu030: IndexData | null;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

const POLLING_INTERVAL = 60000; // 60 saniye
const BIST_CACHE_KEY = 'bist100_cache';
const CRYPTO_CACHE_KEY = 'crypto_prices_cache';

// LocalStorage cache yardımcıları
const readCache = (key: string): { stocks: MarketStock[]; updatedAt: string } | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeCache = (key: string, stocks: MarketStock[], updatedAt: string) => {
  try {
    localStorage.setItem(key, JSON.stringify({ stocks, updatedAt }));
  } catch (e) {
    console.error('Cache write error:', e);
  }
};

function stocksHash(stocks: MarketStock[]): string {
  return stocks.map(s => `${s.symbol}:${s.last}:${s.chgPct}`).join('|');
}

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [bistStocks, setBistStocks] = useState<MarketStock[]>(() => {
    return readCache(BIST_CACHE_KEY)?.stocks ?? [];
  });
  const [cryptoStocks, setCryptoStocks] = useState<MarketStock[]>(() => {
    return readCache(CRYPTO_CACHE_KEY)?.stocks ?? [];
  });

  // Kripto/emtia önde, BIST arkada
  const stocks = useMemo<MarketStock[]>(() => [...cryptoStocks, ...bistStocks], [cryptoStocks, bistStocks]);

  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    return readCache(BIST_CACHE_KEY)?.updatedAt ?? null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [xu100, setXu100] = useState<IndexData | null>(null);
  const [xu030, setXu030] = useState<IndexData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const bistHashRef = useRef<string>('');
  const cryptoHashRef = useRef<string>('');

  const fetchIndices = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('bist-indices');
      if (fnError) throw new Error(fnError.message);
      if (data?.indices?.XU100) setXu100(data.indices.XU100);
      if (data?.indices?.XU030) setXu030(data.indices.XU030);
    } catch (err) {
      console.error('Index fetch error:', err);
    }
  }, []);

  const fetchCryptoPrices = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('crypto-prices');
      if (fnError) throw new Error(fnError.message);
      const response = data as MarketDataResponse;
      if (response.items && response.items.length > 0) {
        const newHash = stocksHash(response.items);
        if (newHash !== cryptoHashRef.current) {
          cryptoHashRef.current = newHash;
          setCryptoStocks(response.items);
          writeCache(CRYPTO_CACHE_KEY, response.items, response.updatedAt);
        }
      }
    } catch (err) {
      console.error('[crypto-prices] fetch error:', err);
      // Eski önbelleği koru — setCryptoStocks'a dokunma
    }
  }, []);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('bist100');

      if (fnError) throw new Error(fnError.message);

      const response = data as MarketDataResponse;

      if (response.error) throw new Error(response.error);

      if (response.items && response.items.length > 0) {
        const newHash = stocksHash(response.items);
        if (newHash !== bistHashRef.current) {
          bistHashRef.current = newHash;
          setBistStocks(response.items);
        }
        setLastUpdated(response.updatedAt);
        setIsFallback(false);
        writeCache(BIST_CACHE_KEY, response.items, response.updatedAt);
      }
    } catch (err) {
      console.error('Market data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Veri alınamadı');

      const cached = readCache(BIST_CACHE_KEY);
      if (cached && cached.stocks.length > 0) {
        const newHash = stocksHash(cached.stocks);
        if (newHash !== bistHashRef.current) {
          bistHashRef.current = newHash;
          setBistStocks(cached.stocks);
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
    // İlk yükleme — hepsi paralel
    fetchMarketData();
    fetchCryptoPrices();
    fetchIndices();

    intervalRef.current = setInterval(() => {
      fetchMarketData();
      fetchCryptoPrices();
      fetchIndices();
    }, POLLING_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMarketData, fetchCryptoPrices, fetchIndices]);

  const value: MarketDataContextType = {
    stocks,
    lastUpdated,
    isLoading,
    error,
    isFallback,
    refetch: fetchMarketData,
    getStockBySymbol,
    xu100,
    xu030,
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
