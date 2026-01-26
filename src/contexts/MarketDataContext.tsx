import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { MarketStock, MarketDataResponse } from '@/types/market';
import { MOCK_STOCKS } from '@/data/mockStocks';

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

const API_ENDPOINT = '/api/bist100.php';
const POLLING_INTERVAL = 60000; // 60 saniye
const CACHE_KEY = 'bist100_cache';

// Mock verileri MarketStock formatına dönüştür
const mockToMarketStock = (): MarketStock[] => {
  return MOCK_STOCKS.map(stock => ({
    symbol: stock.symbol,
    last: stock.currentPrice,
    low: stock.currentPrice * 0.98,
    high: stock.currentPrice * 1.02,
    chg: stock.change,
    chgPct: stock.changePercent,
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }));
};

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

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [stocks, setStocks] = useState<MarketStock[]>(() => {
    // İlk yüklemede cache varsa kullan, yoksa mock
    const cached = getCachedData();
    return cached?.stocks || mockToMarketStock();
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    const cached = getCachedData();
    return cached?.updatedAt || null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINT);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: MarketDataResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.items && data.items.length > 0) {
        setStocks(data.items);
        setLastUpdated(data.updatedAt);
        setIsFallback(false);
        setCachedData(data.items, data.updatedAt);
      }
    } catch (err) {
      console.error('Market data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Veri alınamadı');
      
      // Hata durumunda cache'e düş
      const cached = getCachedData();
      if (cached && cached.stocks.length > 0) {
        setStocks(cached.stocks);
        setLastUpdated(cached.updatedAt);
        setIsFallback(true);
      } else {
        // Cache de yoksa mock kullan
        setStocks(mockToMarketStock());
        setIsFallback(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getStockBySymbol = useCallback((symbol: string): MarketStock | undefined => {
    return stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
  }, [stocks]);

  // İlk yükleme ve polling
  useEffect(() => {
    // İlk fetch
    fetchMarketData();

    // Polling başlat
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
