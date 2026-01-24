import { useQuery } from '@tanstack/react-query';
import { fetchBist100Prices } from '@/services/bistApi';
import { MOCK_STOCKS } from '@/data/mockStocks';
import type { BistStock } from '@/types/stock';

const REFETCH_INTERVAL = 30 * 1000; // 30 seconds

// Convert mock stocks to BistStock format for fallback
const FALLBACK_STOCKS: BistStock[] = MOCK_STOCKS.map((s) => ({
  symbol: s.symbol,
  name: s.name,
  lastPrice: s.currentPrice,
  change: s.change,
  changePercent: s.changePercent,
  volume: null,
  time: null,
}));

export function useBistPrices() {
  const query = useQuery<BistStock[], Error>({
    queryKey: ['bist-prices'],
    queryFn: fetchBist100Prices,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL,
    retry: 2,
    retryDelay: 5000,
  });

  // Use API data if available, otherwise fallback to mock data
  const stocks = query.data && query.data.length > 0 ? query.data : FALLBACK_STOCKS;
  const isUsingFallback = !query.data || query.data.length === 0;

  // Helper to get a single stock by symbol
  const getStockBySymbol = (symbol: string): BistStock | undefined => {
    return stocks.find(
      (stock) => stock.symbol.toUpperCase() === symbol.toUpperCase()
    );
  };

  // Get last price for a symbol
  const getLastPrice = (symbol: string): number | null => {
    const stock = getStockBySymbol(symbol);
    return stock?.lastPrice ?? null;
  };

  // Get top stocks for ticker (by volume or just first N)
  const getTickerStocks = (count: number = 25): BistStock[] => {
    // Sort by volume if available, otherwise just take first N
    const sorted = [...stocks].sort((a, b) => {
      if (a.volume && b.volume) return b.volume - a.volume;
      return 0;
    });
    
    return sorted.slice(0, count);
  };

  return {
    stocks,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    isUsingFallback,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    getStockBySymbol,
    getLastPrice,
    getTickerStocks,
    refetch: query.refetch,
  };
}
