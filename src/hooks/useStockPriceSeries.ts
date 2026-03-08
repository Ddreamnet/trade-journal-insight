import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
// Price series fetched from stock-series edge function
import { Trade } from '@/types/trade';
import { format, parseISO, addDays, startOfDay } from 'date-fns';

interface PricePoint {
  date: string;
  value: number;
}

interface StockSeriesResponse {
  [symbol: string]: {
    points: PricePoint[];
    source: string;
  };
}

export interface StockPriceData {
  priceMap: Map<string, Map<string, number>>; // symbol -> dateKey -> closePrice
  missingSymbols: string[];
  isLoading: boolean;
}

/**
 * Detect symbols that have an open position within the view window
 */
function detectActiveSymbols(
  allTrades: Trade[],
  startDate: Date,
  endDate: Date
): string[] {
  const symbols = new Set<string>();

  for (const trade of allTrades) {
    const tradeOpen = startOfDay(parseISO(trade.created_at));
    const tradeClosed = trade.closed_at ? startOfDay(parseISO(trade.closed_at)) : null;

    // Trade has overlap with view window if:
    // opened before endDate AND (not closed OR closed after startDate)
    const opensBeforeEnd = tradeOpen <= endDate;
    const closesAfterStart = !tradeClosed || tradeClosed >= startDate;

    if (opensBeforeEnd && closesAfterStart) {
      symbols.add(trade.stock_symbol);
    }
  }

  return Array.from(symbols).sort();
}

/**
 * Build a daily price map with carry-forward for weekends/holidays
 */
function buildDailyPriceMap(
  points: PricePoint[],
  startDate: Date,
  endDate: Date
): Map<string, number> {
  const map = new Map<string, number>();
  if (points.length === 0) return map;

  // Index raw points by date
  const rawMap = new Map<string, number>();
  for (const p of points) {
    rawMap.set(p.date, p.value);
  }

  // Fill daily with carry-forward
  let lastKnown: number | null = null;

  // Find the earliest point before startDate for initial carry-forward
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of sorted) {
    if (parseISO(p.date) <= startDate) {
      lastKnown = p.value;
    }
  }

  let currentDay = startDate;
  while (currentDay <= endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    const rawValue = rawMap.get(key);

    if (rawValue !== undefined) {
      lastKnown = rawValue;
    }

    if (lastKnown !== null) {
      map.set(key, lastKnown);
    }

    currentDay = addDays(currentDay, 1);
  }

  return map;
}

export function useStockPriceSeries(
  allTrades: Trade[],
  startDate: Date,
  endDate: Date
): StockPriceData {
  // Detect which symbols we need
  const symbols = useMemo(
    () => detectActiveSymbols(allTrades, startDate, endDate),
    [allTrades, startDate, endDate]
  );

  const symbolsKey = symbols.join(',');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-price-series', symbolsKey],
    queryFn: async (): Promise<StockSeriesResponse> => {
      if (symbols.length === 0) return {};

      const projectUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pjqbpkblutbdpfzzwxmr.supabase.co';
      const response = await fetch(
        `${projectUrl}/functions/v1/stock-series?symbols=${encodeURIComponent(symbolsKey)}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        console.error('stock-series fetch failed:', response.status);
        return {};
      }

      return response.json();
    },
    enabled: symbols.length > 0,
    staleTime: 30 * 60 * 1000, // 30 min
    gcTime: 60 * 60 * 1000,
  });

  const result = useMemo(() => {
    const priceMap = new Map<string, Map<string, number>>();
    const missingSymbols: string[] = [];

    if (!data) {
      return { priceMap, missingSymbols: symbols, isLoading };
    }

    for (const symbol of symbols) {
      const symbolData = data[symbol];
      if (!symbolData || symbolData.points.length === 0) {
        missingSymbols.push(symbol);
        continue;
      }

      const dailyMap = buildDailyPriceMap(symbolData.points, startDate, endDate);
      priceMap.set(symbol, dailyMap);
    }

    return { priceMap, missingSymbols, isLoading };
  }, [data, symbols, startDate, endDate, isLoading]);

  return result;
}
