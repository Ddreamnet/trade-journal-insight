import { useMemo, useEffect, useCallback } from 'react';
import { Trade, TimeRange, EquityChartPoint, EquitySummary } from '@/types/trade';
import { MarketAsset, MarketSeriesPoint } from '@/types/market';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import {
  parseISO,
  subMonths,
  startOfYear,
  format,
  isAfter,
  isBefore,
  isEqual,
  eachDayOfInterval,
  eachWeekOfInterval,
  startOfWeek,
  startOfDay,
} from 'date-fns';
import { tr } from 'date-fns/locale';

const DEFAULT_INITIAL_CAPITAL = 1000;

interface UseEquityCurveResult {
  chartData: EquityChartPoint[];
  summary: EquitySummary;
  isLoading: boolean;
  hasData: boolean;
  missingPositionAmounts: number;
}

// Calculate PnL for a trade
function calculateTradePnL(trade: Trade): number {
  if (!trade.exit_price || !trade.position_amount) return 0;

  const entry = trade.entry_price;
  const exit = trade.exit_price;
  const positionAmount = trade.position_amount;

  let returnPercent: number;

  if (trade.trade_type === 'buy') {
    returnPercent = (exit - entry) / entry;
  } else {
    returnPercent = (entry - exit) / entry;
  }

  return positionAmount * returnPercent;
}

// Find price at a specific date (carry-back for missing days)
function findPriceAtDate(points: MarketSeriesPoint[], targetDate: Date): number | null {
  if (!points || points.length === 0) return null;

  let latestPrice: number | null = null;
  for (const point of points) {
    const pointDate = parseISO(point.date);
    if (isAfter(pointDate, targetDate)) break;
    latestPrice = point.value;
  }

  return latestPrice;
}

// Calculate benchmark PnL for a trade (what if this money was invested in benchmark)
function calculateBenchmarkPnL(
  trade: Trade,
  benchmarkPoints: MarketSeriesPoint[]
): number | null {
  if (!trade.position_amount || !trade.created_at || !trade.closed_at) return null;

  const entryDate = parseISO(trade.created_at);
  const exitDate = parseISO(trade.closed_at);

  const entryPrice = findPriceAtDate(benchmarkPoints, entryDate);
  const exitPrice = findPriceAtDate(benchmarkPoints, exitDate);

  if (entryPrice === null || exitPrice === null || entryPrice === 0) return null;

  // Calculate: units = position_amount / entry_price
  // benchmark_value_at_exit = units * exit_price
  // benchmark_pnl = benchmark_value_at_exit - position_amount
  const units = trade.position_amount / entryPrice;
  const benchmarkValueAtExit = units * exitPrice;
  const benchmarkPnL = benchmarkValueAtExit - trade.position_amount;

  return benchmarkPnL;
}

// Calculate cumulative inflation factor for a period
function calculateInflationFactor(
  inflationPoints: MarketSeriesPoint[],
  startDate: Date,
  endDate: Date
): number {
  if (!inflationPoints || inflationPoints.length === 0) return 1;

  let factor = 1;
  for (const point of inflationPoints) {
    const pointDate = parseISO(point.date);
    if (isAfter(pointDate, startDate) && !isAfter(pointDate, endDate)) {
      // point.value is monthly percent change
      factor *= 1 + point.value / 100;
    }
  }

  return factor;
}

// Get time range start date
function getTimeRangeStartDate(timeRange: TimeRange): Date {
  const now = new Date();

  switch (timeRange) {
    case '1m':
      return subMonths(now, 1);
    case '3m':
      return subMonths(now, 3);
    case '1y':
      return subMonths(now, 12);
    case 'ytd':
      return startOfYear(now);
    default:
      return subMonths(now, 1);
  }
}

// Generate date intervals for chart
function generateIntervals(timeRange: TimeRange): { intervals: Date[]; groupBy: 'day' | 'week' } {
  const now = new Date();
  const startDate = getTimeRangeStartDate(timeRange);

  if (timeRange === '1m') {
    // Daily for 1 month
    return {
      intervals: eachDayOfInterval({ start: startDate, end: now }),
      groupBy: 'day',
    };
  } else {
    // Weekly for longer periods
    return {
      intervals: eachWeekOfInterval(
        { start: startOfWeek(startDate, { weekStartsOn: 1 }), end: now },
        { weekStartsOn: 1 }
      ),
      groupBy: 'week',
    };
  }
}

export function useEquityCurve(
  closedTrades: Trade[],
  timeRange: TimeRange,
  selectedBenchmarks: MarketAsset[],
  initialCapital: number = DEFAULT_INITIAL_CAPITAL
): UseEquityCurveResult {
  const { getSeriesData, fetchSeries, isLoading: isBenchmarkLoading } = useMarketSeries();

  // Fetch benchmark data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((asset) => {
      fetchSeries(asset);
    });
    // Always fetch inflation for purchasing power display
    fetchSeries('inflation_tr');
  }, [selectedBenchmarks, fetchSeries]);

  // Filter trades with valid data for equity calculation
  const validTrades = useMemo(() => {
    return closedTrades.filter(
      (t) => t.closed_at && t.position_amount && t.exit_price
    );
  }, [closedTrades]);

  // Count trades missing position_amount
  const missingPositionAmounts = useMemo(() => {
    return closedTrades.filter((t) => t.closed_at && !t.position_amount).length;
  }, [closedTrades]);

  // Get benchmark series data
  const benchmarkData = useMemo(() => {
    const data: Partial<Record<MarketAsset, MarketSeriesPoint[]>> = {};
    const allAssets: MarketAsset[] = ['gold', 'usd', 'eur', 'bist100', 'nasdaq100', 'inflation_tr'];

    allAssets.forEach((asset) => {
      const seriesData = getSeriesData(asset);
      if (seriesData?.points && seriesData.points.length > 0) {
        // Sort by date
        data[asset] = [...seriesData.points].sort(
          (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
        );
      }
    });

    return data;
  }, [getSeriesData, selectedBenchmarks]);

  // Calculate chart data
  const { chartData, summary } = useMemo(() => {
    const startDate = getTimeRangeStartDate(timeRange);
    const now = new Date();
    const { intervals, groupBy } = generateIntervals(timeRange);

    // Filter trades within time range
    const tradesInRange = validTrades.filter((t) => {
      const closedAt = parseISO(t.closed_at!);
      return isAfter(closedAt, startDate) || isEqual(closedAt, startDate);
    });

    // Sort trades by closed_at
    const sortedTrades = [...tradesInRange].sort((a, b) => {
      return parseISO(a.closed_at!).getTime() - parseISO(b.closed_at!).getTime();
    });

    // Calculate portfolio equity at each point
    // Start from initialCapital at the beginning of the period
    let portfolioEquity = initialCapital;
    const benchmarkEquities: Partial<Record<MarketAsset, number>> = {};

    // Initialize benchmark equities
    selectedBenchmarks.forEach((asset) => {
      benchmarkEquities[asset] = initialCapital;
    });

    // Group trades by interval
    const tradesByDate = new Map<string, Trade[]>();
    sortedTrades.forEach((trade) => {
      const closedDate = parseISO(trade.closed_at!);
      let key: string;

      if (groupBy === 'day') {
        key = format(startOfDay(closedDate), 'yyyy-MM-dd');
      } else {
        key = format(startOfWeek(closedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      }

      const existing = tradesByDate.get(key) || [];
      existing.push(trade);
      tradesByDate.set(key, existing);
    });

    // Calculate initial values at start of period for normalization
    const startPortfolioEquity = initialCapital;
    const startBenchmarkEquities: Partial<Record<MarketAsset, number>> = {};
    selectedBenchmarks.forEach((asset) => {
      startBenchmarkEquities[asset] = initialCapital;
    });

    // Build chart data points
    const dataPoints: EquityChartPoint[] = [];
    let runningPortfolioEquity = initialCapital;
    const runningBenchmarkEquities: Partial<Record<MarketAsset, number>> = {};
    selectedBenchmarks.forEach((asset) => {
      runningBenchmarkEquities[asset] = initialCapital;
    });

    intervals.forEach((interval, index) => {
      let dateKey: string;
      let dateLabel: string;
      let rawDate: string;

      if (groupBy === 'day') {
        dateKey = format(interval, 'yyyy-MM-dd');
        rawDate = dateKey;
        dateLabel = format(interval, 'd MMM', { locale: tr });
      } else {
        dateKey = format(startOfWeek(interval, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        rawDate = dateKey;
        dateLabel = format(interval, 'd MMM', { locale: tr });
      }

      // Process trades closed in this interval
      const tradesInInterval = tradesByDate.get(dateKey) || [];

      tradesInInterval.forEach((trade) => {
        // Portfolio PnL
        const pnl = calculateTradePnL(trade);
        runningPortfolioEquity += pnl;

        // Benchmark PnLs
        selectedBenchmarks.forEach((asset) => {
          if (asset === 'inflation_tr') return; // Inflation handled separately

          const assetPoints = benchmarkData[asset];
          if (assetPoints) {
            const benchPnL = calculateBenchmarkPnL(trade, assetPoints);
            if (benchPnL !== null) {
              runningBenchmarkEquities[asset] = (runningBenchmarkEquities[asset] || initialCapital) + benchPnL;
            }
          }
        });
      });

      // Calculate returns
      const portfolioReturnPct =
        ((runningPortfolioEquity - startPortfolioEquity) / startPortfolioEquity) * 100;

      const point: EquityChartPoint = {
        date: dateLabel,
        rawDate,
        portfolioEquity: parseFloat(runningPortfolioEquity.toFixed(2)),
        portfolioReturnPct: parseFloat(portfolioReturnPct.toFixed(2)),
      };

      // Calculate benchmark relative diffs
      selectedBenchmarks.forEach((asset) => {
        if (asset === 'inflation_tr') {
          // Handle inflation as purchasing power
          const inflationPoints = benchmarkData['inflation_tr'];
          if (inflationPoints) {
            const factor = calculateInflationFactor(inflationPoints, startDate, parseISO(rawDate));
            const purchasingPower = initialCapital * factor;
            point.inflationPurchasingPower = parseFloat(purchasingPower.toFixed(2));

            // Calculate relative diff for chart
            const inflationReturnPct = ((purchasingPower - initialCapital) / initialCapital) * 100;
            point.inflation_tr = parseFloat((inflationReturnPct - portfolioReturnPct).toFixed(2));
          }
        } else {
          const benchEquity = runningBenchmarkEquities[asset] || initialCapital;
          const benchReturnPct =
            ((benchEquity - (startBenchmarkEquities[asset] || initialCapital)) /
              (startBenchmarkEquities[asset] || initialCapital)) *
            100;
          const relativeDiff = benchReturnPct - portfolioReturnPct;

          // Set both relative diff and absolute value
          const assetKey = asset as keyof EquityChartPoint;
          const valueKey = `${asset}Value` as keyof EquityChartPoint;
          (point as any)[assetKey] = parseFloat(relativeDiff.toFixed(2));
          (point as any)[valueKey] = parseFloat(benchEquity.toFixed(2));
        }
      });

      dataPoints.push(point);
    });

    // Calculate summary for the final point
    const lastPoint = dataPoints[dataPoints.length - 1];
    const benchmarkDiffs: Partial<Record<MarketAsset, number>> = {};
    const benchmarkValues: Partial<Record<MarketAsset, number>> = {};

    selectedBenchmarks.forEach((asset) => {
      if (lastPoint) {
        const assetKey = asset as keyof EquityChartPoint;
        const valueKey = `${asset}Value` as keyof EquityChartPoint;
        benchmarkDiffs[asset] = (lastPoint as any)[assetKey] || 0;
        benchmarkValues[asset] = (lastPoint as any)[valueKey] || initialCapital;
      }
    });

    // Calculate final inflation purchasing power
    const inflationPoints = benchmarkData['inflation_tr'];
    let inflationPurchasingPower = { from: initialCapital, to: initialCapital };
    if (inflationPoints) {
      const factor = calculateInflationFactor(inflationPoints, startDate, now);
      inflationPurchasingPower = {
        from: initialCapital,
        to: parseFloat((initialCapital * factor).toFixed(2)),
      };
    }

    const summaryData: EquitySummary = {
      initialCapital,
      currentPortfolioValue: lastPoint?.portfolioEquity || initialCapital,
      portfolioReturnPct: lastPoint?.portfolioReturnPct || 0,
      benchmarkDiffs,
      benchmarkValues,
      inflationPurchasingPower,
    };

    return { chartData: dataPoints, summary: summaryData };
  }, [validTrades, timeRange, selectedBenchmarks, benchmarkData, initialCapital]);

  // Check if any benchmark is loading
  const isLoading = selectedBenchmarks.some((asset) => isBenchmarkLoading(asset));

  // Check if there's valid data
  const hasData = validTrades.length > 0;

  return {
    chartData,
    summary,
    isLoading,
    hasData,
    missingPositionAmounts,
  };
}
