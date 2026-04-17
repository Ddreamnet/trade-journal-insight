import { useMemo, useEffect } from 'react';
import { TimeRange, Trade } from '@/types/trade';
import { MarketAsset, MarketSeriesPoint } from '@/types/market';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import {
  format,
  parseISO,
  startOfDay,
  addDays,
  isBefore,
  subMonths,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  PartialCloseRecord,
  groupPartialClosesByTrade,
  calculateUnrealizedPnL,
} from '@/lib/portfolioCalc';

// Re-export for backward compatibility
export type { PartialCloseRecord } from '@/lib/portfolioCalc';

export interface ChartDataPoint {
  date: string;
  rawDate: string;
  portfolioIndex: number | null;
  portfolioTL: number | null;
  gold?: number | null;
  silver?: number | null;
  usd?: number | null;
  eur?: number | null;
  bist100?: number | null;
  nasdaq100?: number | null;
  inflation_tr?: number | null;
  btcusdt?: number | null;
}

export interface EquityCurveData {
  chartData: ChartDataPoint[];
  t0: Date | null;
  startDate: Date;
  endDate: Date;
  portfolioIndexMap: Map<string, { index: number; tl: number }>;
  benchmarkDataMaps: Record<string, Map<string, number>>;
}

/**
 * Calculate t0 from ALL trades (earliest created_at)
 */
export function calculateT0FromTrades(allTrades: Trade[]): Date | null {
  const validTrades = allTrades.filter((t) => t.created_at);
  if (validTrades.length === 0) return null;

  return validTrades.reduce((earliest, trade) => {
    const d = startOfDay(parseISO(trade.created_at));
    return d < earliest ? d : earliest;
  }, startOfDay(parseISO(validTrades[0].created_at)));
}

// Keep backward-compatible alias
export const calculateT0FromClosedTrades = calculateT0FromTrades;

/**
 * Calculate view window dates based on time range
 */
export function getTimeRangeDates(timeRange: TimeRange, today: Date): { startDate: Date; endDate: Date } {
  const endDate = startOfDay(today);
  let startDate: Date;

  switch (timeRange) {
    case '1m':
      startDate = subMonths(endDate, 1);
      break;
    case '3m':
      startDate = subMonths(endDate, 3);
      break;
    case '6m':
      startDate = subMonths(endDate, 6);
      break;
    case '1y':
      startDate = subMonths(endDate, 12);
      break;
    case '3y':
      startDate = subMonths(endDate, 36);
      break;
    default:
      startDate = subMonths(endDate, 1);
  }

  return { startDate: startOfDay(startDate), endDate };
}

/**
 * Step PnL approach: realized PnL applied on the partial close date
 */
function calculateCumulativeRealizedPnL(partialCloses: PartialCloseRecord[]): Map<string, number> {
  const dailyPnL = new Map<string, number>();
  for (const pc of partialCloses) {
    if (!pc.realized_pnl) continue;
    const key = format(startOfDay(parseISO(pc.created_at)), 'yyyy-MM-dd');
    dailyPnL.set(key, (dailyPnL.get(key) || 0) + pc.realized_pnl);
  }
  return dailyPnL;
}

/**
 * For a given trade, compute remaining_lot at a specific day
 * by subtracting partial closes that happened on or before that day
 */
// getRemainingLotAtDay and linearInterpolatePrice are now in @/lib/portfolioCalc

// Find value at date with carry-forward
function findValueAtDateWithCarryForward(
  points: MarketSeriesPoint[],
  targetDate: Date
): number | null {
  if (!points || points.length === 0) return null;

  const sorted = [...points].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  let lastKnown: number | null = null;
  const targetTime = targetDate.getTime();

  for (const p of sorted) {
    const pTime = parseISO(p.date).getTime();
    if (pTime <= targetTime) {
      lastKnown = p.value;
    } else {
      break;
    }
  }

  return lastKnown;
}

/**
 * Normalize benchmark from normStart with carry-forward for all days
 * Uses Map for O(1) lookups
 */
function normalizeBenchmarkFromStartWithCarryForward(
  points: MarketSeriesPoint[],
  normStart: Date,
  endDate: Date
): Map<string, number> {
  const result = new Map<string, number>();
  if (!points || points.length === 0) return result;

  const startValue = findValueAtDateWithCarryForward(points, normStart);
  if (!startValue) return result;

  const valueByDate = new Map<string, number>(
    points.map((p) => [p.date.substring(0, 10), p.value])
  );

  let lastKnownValue = startValue;
  let currentDay = normStart;

  while (currentDay <= endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    const pointValue = valueByDate.get(key);

    if (pointValue !== undefined) {
      lastKnownValue = pointValue;
    }

    result.set(key, 100 * (lastKnownValue / startValue));
    currentDay = addDays(currentDay, 1);
  }

  return result;
}

/**
 * Normalize Nasdaq100 in TL terms: nasdaq_usd[t] * usdtry[t], then normalize to 100
 */
function normalizeNasdaqInTL(
  nasdaqPoints: MarketSeriesPoint[],
  usdtryPoints: MarketSeriesPoint[],
  normStart: Date,
  endDate: Date
): Map<string, number> {
  const result = new Map<string, number>();
  if (!nasdaqPoints.length || !usdtryPoints.length) return result;

  // Build date->value maps
  const nasdaqByDate = new Map<string, number>(
    nasdaqPoints.map((p) => [p.date.substring(0, 10), p.value])
  );
  const usdtryByDate = new Map<string, number>(
    usdtryPoints.map((p) => [p.date.substring(0, 10), p.value])
  );

  // Find start values with carry-forward
  const nasdaqStart = findValueAtDateWithCarryForward(nasdaqPoints, normStart);
  const usdtryStart = findValueAtDateWithCarryForward(usdtryPoints, normStart);
  if (!nasdaqStart || !usdtryStart) return result;

  const tlStart = nasdaqStart * usdtryStart;

  let lastNasdaq = nasdaqStart;
  let lastUsdtry = usdtryStart;
  let currentDay = normStart;

  while (currentDay <= endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');

    const nasdaqVal = nasdaqByDate.get(key);
    if (nasdaqVal !== undefined) lastNasdaq = nasdaqVal;

    const usdtryVal = usdtryByDate.get(key);
    if (usdtryVal !== undefined) lastUsdtry = usdtryVal;

    const tlValue = lastNasdaq * lastUsdtry;
    result.set(key, 100 * (tlValue / tlStart));

    currentDay = addDays(currentDay, 1);
  }

  return result;
}

/**
 * Convert inflation monthly rates to compound index starting from normStart
 */
function convertInflationToCompoundIndex(
  monthlyRates: MarketSeriesPoint[],
  normStart: Date,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!monthlyRates || monthlyRates.length === 0) return result;

  const sortedRates = [...monthlyRates].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const startMonth = format(normStart, 'yyyy-MM');
  let startIndex = sortedRates.findIndex((r) => r.date.startsWith(startMonth));

  if (startIndex === -1) {
    const startTime = normStart.getTime();
    startIndex = sortedRates.findIndex((r) => parseISO(r.date).getTime() > startTime);
    if (startIndex === -1) return result;
    const syntheticDate = format(normStart, 'yyyy-MM-01');
    result.set(syntheticDate, 100);
  }

  let index = 100;

  for (let i = startIndex; i < sortedRates.length; i++) {
    const rate = sortedRates[i].value;
    const dateKey = sortedRates[i].date.substring(0, 10);
    const monthKey = sortedRates[i].date.substring(0, 7);

    if (monthKey === startMonth) {
      result.set(dateKey, 100);
    } else {
      index = index * (1 + rate / 100);
      result.set(dateKey, parseFloat(index.toFixed(2)));
    }
  }

  return result;
}

/**
 * Convert monthly inflation map to daily map with carry-forward
 */
function inflationMonthlyToDailyWithCarryForward(
  monthlyMap: Map<string, number>,
  startDate: Date,
  endDate: Date
): Map<string, number> {
  const result = new Map<string, number>();
  let lastKnownValue: number | null = null;
  let currentDay = startDate;

  while (currentDay <= endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    const monthKey = format(currentDay, 'yyyy-MM');

    for (const [dateKey, value] of monthlyMap.entries()) {
      if (dateKey.startsWith(monthKey)) {
        lastKnownValue = value;
        break;
      }
    }

    if (lastKnownValue !== null) {
      result.set(key, lastKnownValue);
    }

    currentDay = addDays(currentDay, 1);
  }

  return result;
}

export function useEquityCurveData(
  timeRange: TimeRange,
  selectedBenchmarks: string[],
  closedTrades: Trade[],
  startingCapital: number,
  partialCloses: PartialCloseRecord[] = [],
  allTrades: Trade[] = [],
  stockPriceMap: Map<string, Map<string, number>> = new Map(),
  priceDataMissing: string[] = []
): EquityCurveData {
  const { getSeriesData, fetchSeries } = useMarketSeries();
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // Fetch data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((benchmarkId) => {
      fetchSeries(benchmarkId as MarketAsset);
    });
    // Nasdaq100 seçiliyse USD/TRY serisini de çek (TL dönüşümü için)
    if (selectedBenchmarks.includes('nasdaq100')) {
      fetchSeries('usd' as MarketAsset);
    }
  }, [selectedBenchmarks, fetchSeries]);

  // Use allTrades for t0 (earliest trade open date)
  const tradesForT0 = useMemo(
    () => (allTrades.length > 0 ? allTrades : closedTrades).filter((t) => t.created_at),
    [allTrades, closedTrades]
  );

  // Calculate t0 from ALL trades
  const t0 = useMemo(
    () => calculateT0FromTrades(tradesForT0),
    [tradesForT0]
  );

  // View window dates based on time range
  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeRange, todayKey]
  );

  // effectiveStart = max(t0, viewStartDate) for normalization
  const effectiveStart = useMemo(() => {
    if (!t0) return startDate;
    return t0 > startDate ? t0 : startDate;
  }, [t0, startDate]);

  // Group partial closes by trade_id for fast lookup
  const partialClosesByTrade = useMemo(
    () => groupPartialClosesByTrade(partialCloses),
    [partialCloses]
  );

  // Build RAW portfolio value from t0 to endDate using realized + unrealized PnL
  const rawPortfolioIndexMap = useMemo(() => {
    const map = new Map<string, { index: number; tl: number }>();
    if (!t0) return map;

    // Pre-compute daily realized PnL contributions
    const dailyRealizedPnL = calculateCumulativeRealizedPnL(partialCloses);

    // Determine which symbols are missing price data (for fallback)
    const missingSet = new Set(priceDataMissing);

    let cumulativeRealized = 0;
    let currentDay = t0;

    while (currentDay <= endDate) {
      const key = format(currentDay, 'yyyy-MM-dd');

      // Add realized PnL for this day
      const dayRealized = dailyRealizedPnL.get(key) || 0;
      cumulativeRealized += dayRealized;

      // Calculate unrealized PnL for all trades open on this day
      const unrealizedPnL = calculateUnrealizedPnL(
        allTrades, currentDay, key, partialClosesByTrade, stockPriceMap, missingSet
      );

      const portfolioValue = startingCapital + cumulativeRealized + unrealizedPnL;

      map.set(key, {
        index: 100 * (portfolioValue / startingCapital),
        tl: portfolioValue,
      });

      currentDay = addDays(currentDay, 1);
    }

    return map;
  }, [t0, partialCloses, startingCapital, endDate, allTrades, stockPriceMap, priceDataMissing, partialClosesByTrade]);

  // Normalize portfolio from effectiveStart (effectiveStart = 100)
  const portfolioIndexMap = useMemo(() => {
    const effectiveKey = format(effectiveStart, 'yyyy-MM-dd');
    const viewStartEntry = rawPortfolioIndexMap.get(effectiveKey);
    const viewStartIndex = viewStartEntry?.index || 100;

    const normalized = new Map<string, { index: number; tl: number }>();
    for (const [key, val] of rawPortfolioIndexMap) {
      normalized.set(key, {
        index: (val.index / viewStartIndex) * 100,
        tl: val.tl,
      });
    }
    return normalized;
  }, [rawPortfolioIndexMap, effectiveStart]);

  // Benchmark data normalized from startDate (selected time range start)
  const benchmarkDataMaps = useMemo(() => {
    const result: Record<string, Map<string, number>> = {};
    if (!t0) return result;

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        if (benchmarkId === 'nasdaq100') {
          // Nasdaq100'ü TL bazına çevir: nasdaq_usd * usdtry, sonra normalize
          const usdSeriesData = getSeriesData('usd' as MarketAsset);
          if (usdSeriesData?.points) {
            result[benchmarkId] = normalizeNasdaqInTL(
              seriesData.points,
              usdSeriesData.points,
              startDate,
              endDate
            );
          }
        } else if (benchmarkId === 'inflation_tr') {
          const monthlyMap = convertInflationToCompoundIndex(seriesData.points, startDate);
          result[benchmarkId] = inflationMonthlyToDailyWithCarryForward(monthlyMap, startDate, endDate);
        } else {
          result[benchmarkId] = normalizeBenchmarkFromStartWithCarryForward(
            seriesData.points,
            startDate,
            endDate
          );
        }
      }
    });

    return result;
  }, [selectedBenchmarks, getSeriesData, t0, startDate, endDate]);

  // Build view series from startDate to endDate
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];
    let currentDay = startDate;

    while (currentDay <= endDate) {
      const key = format(currentDay, 'yyyy-MM-dd');
      const isBeforeEffective = isBefore(currentDay, effectiveStart);

      const portfolioData = portfolioIndexMap.get(key);

      const point: ChartDataPoint = {
        date: format(currentDay, 'd MMM', { locale: tr }),
        rawDate: key,
        portfolioIndex: isBeforeEffective ? null : (portfolioData?.index ?? null),
        portfolioTL: isBeforeEffective ? null : (portfolioData?.tl ?? null),
      };

      // Add benchmark values
      for (const [benchmarkId, dataMap] of Object.entries(benchmarkDataMaps)) {
        const value = dataMap.get(key) ?? null;

        switch (benchmarkId) {
          case 'gold':
            point.gold = value;
            break;
          case 'silver':
            point.silver = value;
            break;
          case 'usd':
            point.usd = value;
            break;
          case 'eur':
            point.eur = value;
            break;
          case 'bist100':
            point.bist100 = value;
            break;
          case 'nasdaq100':
            point.nasdaq100 = value;
            break;
          case 'inflation_tr':
            point.inflation_tr = value;
            break;
          case 'btcusdt':
            point.btcusdt = value;
            break;
        }
      }

      data.push(point);
      currentDay = addDays(currentDay, 1);
    }

    return data;
  }, [startDate, endDate, effectiveStart, portfolioIndexMap, benchmarkDataMaps]);

  return {
    chartData,
    t0,
    startDate,
    endDate,
    portfolioIndexMap,
    benchmarkDataMaps,
  };
}
