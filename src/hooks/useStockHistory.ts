import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PricePoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Daily close. */
  value: number;
}

export interface StockHistory {
  points: PricePoint[];
  source: string;
  lastClose: number | null;
  firstClose: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

interface StockSeriesResponse {
  [symbol: string]: { points: PricePoint[]; source: string };
}

/**
 * useStockHistory — single-symbol daily-close series, 3-year depth.
 *
 * Wraps the `stock-series` edge function (Yahoo Finance source). Returns
 * sorted ascending points plus convenient `lastClose` / `firstClose` for
 * header readouts and delta calculations. Cached for 30 minutes to match
 * the edge function's own cache TTL.
 */
export function useStockHistory(symbol: string | null | undefined): StockHistory {
  const normalizedSymbol = symbol?.toUpperCase().trim() || "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["stock-history", normalizedSymbol],
    queryFn: async (): Promise<PricePoint[]> => {
      if (!normalizedSymbol) return [];
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "stock-series",
        { body: { symbols: normalizedSymbol } }
      );
      if (fnError) throw fnError;
      const typed = fnData as StockSeriesResponse | null;
      const entry = typed?.[normalizedSymbol];
      if (!entry || !entry.points) return [];
      return [...entry.points].sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!normalizedSymbol,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const points = useMemo(() => data ?? [], [data]);
  const lastClose = points.length ? points[points.length - 1].value : null;
  const firstClose = points.length ? points[0].value : null;

  return {
    points,
    source: "Yahoo Finance",
    lastClose,
    firstClose,
    isLoading,
    isError,
    error: error as Error | null,
  };
}
