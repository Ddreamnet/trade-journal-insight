import { useMemo, useEffect } from 'react';
import { TimeRange, Trade } from '@/types/trade';
import { MarketAsset, MarketSeriesPoint } from '@/types/market';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import {
  format,
  parseISO,
  startOfDay,
  addDays,
  differenceInDays,
  isBefore,
  subDays,
  subMonths,
} from 'date-fns';
import { tr } from 'date-fns/locale';

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
 * t0 = the opening date of the first trade that has been closed
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
 * Returns startDate and endDate for the X-axis window
 * endDate = today, startDate = today - rangeDays
 */
export function getTimeRangeDates(timeRange: TimeRange, today: Date): { startDate: Date; endDate: Date } {
  const endDate = startOfDay(today);
  let startDate: Date;
  
  switch (timeRange) {
    case '1w':
      startDate = subDays(endDate, 7);
      break;
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

// Calculate daily PnL contributions from closed trades with same-day fix
function calculateDailyPnLContributions(closedTrades: Trade[]): Map<string, number> {
  const dailyPnL = new Map<string, number>();

  for (const trade of closedTrades) {
    if (!trade.position_amount || !trade.exit_price || !trade.closed_at) continue;

    // Calculate PnL based on trade type
    const r = trade.trade_type === 'buy'
      ? (trade.exit_price - trade.entry_price) / trade.entry_price
      : (trade.entry_price - trade.exit_price) / trade.entry_price;
    const pnl = trade.position_amount * r;

    const startDate = startOfDay(parseISO(trade.created_at));
    const endDate = startOfDay(parseISO(trade.closed_at));
    const days = differenceInDays(endDate, startDate);

    if (days === 0) {
      // Same-day trade: apply full PnL to that single day
      const key = format(startDate, 'yyyy-MM-dd');
      dailyPnL.set(key, (dailyPnL.get(key) || 0) + pnl);
    } else {
      // Normal: distribute across days (created_at included, closed_at excluded)
      const dailyContribution = pnl / days;
      let currentDay = startDate;
      while (currentDay < endDate) {
        const key = format(currentDay, 'yyyy-MM-dd');
        dailyPnL.set(key, (dailyPnL.get(key) || 0) + dailyContribution);
        currentDay = addDays(currentDay, 1);
      }
    }
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

// Normalize benchmark from t0 with carry-forward for all days
// Uses Map for O(1) lookups instead of O(n) find() calls
function normalizeBenchmarkFromT0WithCarryForward(
  points: MarketSeriesPoint[],
  t0: Date,
  endDate: Date
): Map<string, number> {
  const result = new Map<string, number>();
  if (!points || points.length === 0) return result;

  const t0Value = findValueAtDateWithCarryForward(points, t0);
  if (!t0Value) return result;

  // Convert to Map for O(1) lookup instead of O(n) find()
  const valueByDate = new Map<string, number>(
    points.map((p) => [p.date.substring(0, 10), p.value])
  );

  let lastKnownValue = t0Value;
  let currentDay = t0;

  while (currentDay <= endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    const pointValue = valueByDate.get(key);

    if (pointValue !== undefined) {
      lastKnownValue = pointValue;
    }

    result.set(key, 100 * (lastKnownValue / t0Value));
    currentDay = addDays(currentDay, 1);
  }

  return result;
}

/**
 * Convert inflation monthly rates to compound index starting from t0
 * Rule: t0 month = 100 (no compounding), first rate applied from month AFTER t0
 */
function convertInflationToCompoundIndex(
  monthlyRates: MarketSeriesPoint[],
  t0: Date,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!monthlyRates || monthlyRates.length === 0) return result;

  const sortedRates = [...monthlyRates].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const t0Month = format(t0, 'yyyy-MM');
  let t0Index = sortedRates.findIndex((r) => r.date.startsWith(t0Month));
  
  // If t0 month not found in data, find first month after t0
  if (t0Index === -1) {
    const t0Time = t0.getTime();
    t0Index = sortedRates.findIndex((r) => parseISO(r.date).getTime() > t0Time);
    
    if (t0Index === -1) return result;
    
    // Add synthetic t0 month entry
    const syntheticT0Date = format(t0, 'yyyy-MM-01');
    result.set(syntheticT0Date, 100);
  }

  let index = 100;

  for (let i = t0Index; i < sortedRates.length; i++) {
    const rate = sortedRates[i].value;
    const dateKey = sortedRates[i].date.substring(0, 10);
    const monthKey = sortedRates[i].date.substring(0, 7);
    
    if (monthKey === t0Month) {
      // t0 month: index stays at 100
      result.set(dateKey, 100);
    } else {
      // Subsequent months: apply compounding
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
    
    // Look for any entry in this month
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
  startingCapital: number
): EquityCurveData {
  const { getSeriesData, fetchSeries } = useMarketSeries();

  // Today key for dependency - recalculates when day changes
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // Fetch data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((benchmarkId) => {
      fetchSeries(benchmarkId as MarketAsset);
    });
  }, [selectedBenchmarks, fetchSeries]);

  // Filter closed trades with position_amount
  const closedTradesWithPositionAmount = useMemo(
    () => closedTrades.filter((t) => t.position_amount && t.exit_price && t.closed_at),
    [closedTrades]
  );

  // Calculate t0 from CLOSED trades only
  const t0 = useMemo(
    () => calculateT0FromClosedTrades(closedTradesWithPositionAmount),
    [closedTradesWithPositionAmount]
  );

  // View window dates based on time range
  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeRange, todayKey]
  );

  // Build full portfolio index from t0 to endDate (Map)
  const portfolioIndexMap = useMemo(() => {
    const map = new Map<string, { index: number; tl: number }>();
    if (!t0 || closedTradesWithPositionAmount.length === 0) return map;

    const dailyPnL = calculateDailyPnLContributions(closedTradesWithPositionAmount);
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
  }, [t0, closedTradesWithPositionAmount, startingCapital, endDate]);

  // Get benchmark data and normalize from t0
  const benchmarkDataMaps = useMemo(() => {
    const result: Record<string, Map<string, number>> = {};
    if (!t0) return result;

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        if (benchmarkId === 'inflation_tr') {
          const monthlyMap = convertInflationToCompoundIndex(seriesData.points, t0);
          result[benchmarkId] = inflationMonthlyToDailyWithCarryForward(monthlyMap, t0, endDate);
        } else {
          result[benchmarkId] = normalizeBenchmarkFromT0WithCarryForward(
            seriesData.points,
            t0,
            endDate
          );
        }
      }
    });

    return result;
  }, [selectedBenchmarks, getSeriesData, t0, endDate]);

  // Build view series from startDate to endDate
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];
    let currentDay = startDate;

    while (currentDay <= endDate) {
      const key = format(currentDay, 'yyyy-MM-dd');
      const isBeforeT0 = t0 ? isBefore(currentDay, t0) : true;

      const portfolioData = portfolioIndexMap.get(key);

      const point: ChartDataPoint = {
        date: format(currentDay, 'd MMM', { locale: tr }),
        rawDate: key,
        portfolioIndex: isBeforeT0 ? null : (portfolioData?.index ?? null),
        portfolioTL: isBeforeT0 ? null : (portfolioData?.tl ?? null),
      };

      // Add benchmark values
      for (const [benchmarkId, dataMap] of Object.entries(benchmarkDataMaps)) {
        const value = isBeforeT0 ? null : (dataMap.get(key) ?? null);
        
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
  }, [startDate, endDate, t0, portfolioIndexMap, benchmarkDataMaps]);

  return {
    chartData,
    t0,
    startDate,
    endDate,
    portfolioIndexMap,
    benchmarkDataMaps,
  };
}
