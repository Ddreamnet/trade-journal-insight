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

export interface PartialCloseRecord {
  id: string;
  trade_id: string;
  realized_pnl: number | null;
  created_at: string;
}

export interface ChartDataPoint {
  date: string;
  rawDate: string;
  portfolioIndex: number | null;
  portfolioTL: number | null;
  gold?: number | null;
  usd?: number | null;
  eur?: number | null;
  bist100?: number | null;
  nasdaq100?: number | null;
  inflation_tr?: number | null;
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
 * Calculate t0 from CLOSED trades only (earliest created_at among closed trades)
 */
export function calculateT0FromClosedTrades(closedTrades: Trade[]): Date | null {
  const validTrades = closedTrades.filter((t) => t.closed_at && t.created_at);
  if (validTrades.length === 0) return null;

  return validTrades.reduce((earliest, trade) => {
    const d = startOfDay(parseISO(trade.created_at));
    return d < earliest ? d : earliest;
  }, startOfDay(parseISO(validTrades[0].created_at)));
}

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
function calculateDailyPnLFromPartialCloses(partialCloses: PartialCloseRecord[]): Map<string, number> {
  const dailyPnL = new Map<string, number>();
  for (const pc of partialCloses) {
    if (!pc.realized_pnl) continue;
    const key = format(startOfDay(parseISO(pc.created_at)), 'yyyy-MM-dd');
    dailyPnL.set(key, (dailyPnL.get(key) || 0) + pc.realized_pnl);
  }
  return dailyPnL;
}

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
  partialCloses: PartialCloseRecord[] = []
): EquityCurveData {
  const { getSeriesData, fetchSeries } = useMarketSeries();
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // Fetch data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((benchmarkId) => {
      fetchSeries(benchmarkId as MarketAsset);
    });
  }, [selectedBenchmarks, fetchSeries]);

  // Filter closed trades with closed_at
  const closedTradesWithData = useMemo(
    () => closedTrades.filter((t) => t.closed_at && t.created_at),
    [closedTrades]
  );

  // Calculate t0 from CLOSED trades only
  const t0 = useMemo(
    () => calculateT0FromClosedTrades(closedTradesWithData),
    [closedTradesWithData]
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

  // Build RAW portfolio index from t0 to endDate using partial closes (step PnL)
  const rawPortfolioIndexMap = useMemo(() => {
    const map = new Map<string, { index: number; tl: number }>();
    if (!t0) return map;

    const dailyPnL = calculateDailyPnLFromPartialCloses(partialCloses);
    let cumulativeTL = startingCapital;
    let currentDay = t0;

    while (currentDay <= endDate) {
      const key = format(currentDay, 'yyyy-MM-dd');
      const dailyContribution = dailyPnL.get(key) || 0;
      cumulativeTL += dailyContribution;

      map.set(key, {
        index: 100 * (cumulativeTL / startingCapital),
        tl: cumulativeTL,
      });

      currentDay = addDays(currentDay, 1);
    }

    return map;
  }, [t0, partialCloses, startingCapital, endDate]);

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

  // Benchmark data normalized from effectiveStart
  const benchmarkDataMaps = useMemo(() => {
    const result: Record<string, Map<string, number>> = {};
    if (!t0) return result;

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        if (benchmarkId === 'inflation_tr') {
          const monthlyMap = convertInflationToCompoundIndex(seriesData.points, effectiveStart);
          result[benchmarkId] = inflationMonthlyToDailyWithCarryForward(monthlyMap, effectiveStart, endDate);
        } else {
          result[benchmarkId] = normalizeBenchmarkFromStartWithCarryForward(
            seriesData.points,
            effectiveStart,
            endDate
          );
        }
      }
    });

    return result;
  }, [selectedBenchmarks, getSeriesData, t0, effectiveStart, endDate]);

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
        const value = isBeforeEffective ? null : (dataMap.get(key) ?? null);

        switch (benchmarkId) {
          case 'gold':
            point.gold = value;
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
