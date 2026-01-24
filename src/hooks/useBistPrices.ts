import { useQuery } from '@tanstack/react-query';
import { fetchBist100Prices } from '@/services/bistApi';
import type { BistStock } from '@/types/stock';

const REFETCH_INTERVAL = 30 * 1000; // 30 seconds

export function useBistPrices() {
  const query = useQuery<BistStock[], Error>({
    queryKey: ['bist-prices'],
    queryFn: fetchBist100Prices,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL,
    retry: 2,
    retryDelay: 5000,
  });

  // Helper to get a single stock by symbol
  const getStockBySymbol = (symbol: string): BistStock | undefined => {
    return query.data?.find(
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
    if (!query.data) return [];
    
    // Sort by volume if available, otherwise just take first N
    const sorted = [...query.data].sort((a, b) => {
      if (a.volume && b.volume) return b.volume - a.volume;
      return 0;
    });
    
    return sorted.slice(0, count);
  };

  return {
    stocks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    getStockBySymbol,
    getLastPrice,
    getTickerStocks,
    refetch: query.refetch,
  };
}
