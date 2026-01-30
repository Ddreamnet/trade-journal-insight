import { useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TimeRange, BenchmarkData, Trade } from '@/types/trade';
import { MarketAsset, MarketSeriesPoint } from '@/types/market';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import {
  format,
  parseISO,
  subDays,
  subMonths,
  startOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfDay,
  startOfWeek,
  startOfMonth,
  isAfter,
  isEqual,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface WinRateChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  filteredTrades: Trade[];
}

interface ChartDataPoint {
  date: string;
  rawDate: string;
  winRate: number | null;
  gold?: number;
  usd?: number;
  eur?: number;
  bist100?: number;
  nasdaq100?: number;
  inflation_tr?: number;
}

// Generate win rate data based on filtered trades
function generateWinRateData(filteredTrades: Trade[], timeRange: TimeRange) {
  const now = new Date();
  let intervals: Date[];
  let groupBy: 'day' | 'week' | 'month';

  switch (timeRange) {
    case '1m':
      intervals = eachDayOfInterval({ start: subDays(now, 29), end: now });
      groupBy = 'day';
      break;
    case '3m':
      intervals = eachWeekOfInterval(
        {
          start: startOfWeek(subMonths(now, 3), { weekStartsOn: 1 }),
          end: now,
        },
        { weekStartsOn: 1 }
      );
      groupBy = 'week';
      break;
    case '1y':
      intervals = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
      groupBy = 'month';
      break;
    case 'ytd':
      intervals = eachWeekOfInterval(
        {
          start: startOfWeek(startOfYear(now), { weekStartsOn: 1 }),
          end: now,
        },
        { weekStartsOn: 1 }
      );
      groupBy = 'week';
      break;
    default:
      intervals = eachDayOfInterval({ start: subDays(now, 29), end: now });
      groupBy = 'day';
  }

  // Group trades by interval
  const tradesByInterval = new Map<string, Trade[]>();

  filteredTrades.forEach((trade) => {
    if (!trade.closed_at) return;
    const closedDate = parseISO(trade.closed_at);
    let key: string;

    if (groupBy === 'day') {
      key = format(startOfDay(closedDate), 'yyyy-MM-dd');
    } else if (groupBy === 'week') {
      key = format(startOfWeek(closedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      key = format(startOfMonth(closedDate), 'yyyy-MM');
    }

    const existing = tradesByInterval.get(key) || [];
    existing.push(trade);
    tradesByInterval.set(key, existing);
  });

  // Calculate cumulative win rate
  let cumulativeTotal = 0;
  let cumulativeSuccess = 0;

  return intervals.map((interval) => {
    let key: string;
    let dateLabel: string;
    let rawDate: string;

    if (groupBy === 'day') {
      key = format(interval, 'yyyy-MM-dd');
      rawDate = key;
      dateLabel = format(interval, 'd MMM', { locale: tr });
    } else if (groupBy === 'week') {
      key = format(startOfWeek(interval, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      rawDate = key;
      dateLabel = format(interval, 'd MMM', { locale: tr });
    } else {
      key = format(interval, 'yyyy-MM');
      rawDate = format(interval, 'yyyy-MM-dd');
      dateLabel = format(interval, 'MMM yy', { locale: tr });
    }

    const tradesInInterval = tradesByInterval.get(key) || [];
    cumulativeTotal += tradesInInterval.length;
    cumulativeSuccess += tradesInInterval.filter((t) => t.is_successful).length;

    const winRate = cumulativeTotal > 0 ? (cumulativeSuccess / cumulativeTotal) * 100 : null;

    return {
      date: dateLabel,
      rawDate,
      winRate: winRate !== null ? parseFloat(winRate.toFixed(1)) : null,
    };
  });
}

// Merge benchmark data into chart data
function mergeBenchmarkData(
  baseData: { date: string; rawDate: string; winRate: number | null }[],
  benchmarkData: Record<MarketAsset, MarketSeriesPoint[]>
): ChartDataPoint[] {
  // Benchmarks come as sparse points (monthly for inflation). Base chart may be weekly/daily.
  // To avoid "no data" in 3m/6m, we carry-forward the last known benchmark value.
  const prepared: Record<string, { date: Date; value: number }[]> = {};

  for (const [asset, points] of Object.entries(benchmarkData)) {
    prepared[asset] = (points || [])
      .map((p) => ({ date: parseISO(p.date), value: p.value }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const findLatestValue = (asset: string, targetIso: string): number | undefined => {
    const list = prepared[asset];
    if (!list || list.length === 0) return undefined;

    const target = parseISO(targetIso);
    // Find latest point where point.date <= target
    let latest: number | undefined;
    for (const p of list) {
      if (isAfter(p.date, target) && !isEqual(p.date, target)) break;
      latest = p.value;
    }
    return latest;
  };

  return baseData.map((point) => {
    const result: ChartDataPoint = {
      date: point.date,
      rawDate: point.rawDate,
      winRate: point.winRate,
    };

    for (const asset of Object.keys(benchmarkData)) {
      const v = findLatestValue(asset, point.rawDate);
      if (v !== undefined) {
        result[asset as MarketAsset] = v;
      }
    }

    return result;
  });
}

export function WinRateChart({ timeRange, selectedBenchmarks, benchmarks, filteredTrades }: WinRateChartProps) {
  const { getSeriesData, fetchSeries, isLoading, filterByTimeRange, normalizeData } = useMarketSeries();

  // Fetch data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((benchmarkId) => {
      fetchSeries(benchmarkId as MarketAsset);
    });
  }, [selectedBenchmarks, fetchSeries]);

  // Generate base win rate data
  const baseData = useMemo(() => generateWinRateData(filteredTrades, timeRange), [filteredTrades, timeRange]);

  // Get and process benchmark data
  const benchmarkSeriesData = useMemo(() => {
    const result: Record<MarketAsset, MarketSeriesPoint[]> = {} as Record<MarketAsset, MarketSeriesPoint[]>;

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        // Filter by time range and normalize
        const filtered = filterByTimeRange(seriesData.points, timeRange);
        const normalized = normalizeData(filtered);
        result[benchmarkId as MarketAsset] = normalized;
      }
    });

    return result;
  }, [selectedBenchmarks, getSeriesData, timeRange, filterByTimeRange, normalizeData]);

  // Merge all data
  const chartData = useMemo(() => mergeBenchmarkData(baseData, benchmarkSeriesData), [baseData, benchmarkSeriesData]);

  // Check if any benchmark is loading
  const anyLoading = selectedBenchmarks.some((id) => isLoading(id as MarketAsset));

  // Check if there's any winrate data
  const hasWinRateData = chartData.some((d) => d.winRate !== null);

  const benchmarkKeyMap: { [key: string]: keyof ChartDataPoint } = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
  };

  return (
    <div className="w-full h-[300px] sm:h-[400px]">
      {anyLoading && selectedBenchmarks.length > 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
      ) : !hasWinRateData && filteredTrades.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Bu dönemde kapatılmış işlem bulunmuyor
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null, name: string) => {
                if (value === null || value === undefined) return ['Veri yok', name];
                if (name === 'Win Rate %') return [`%${value}`, name];
                return [value.toFixed(2), name];
              }}
            />
            <Legend />
            {/* Win Rate - always visible */}
            <Line
              type="monotone"
              dataKey="winRate"
              name="Win Rate %"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              connectNulls
            />
            {/* Benchmark lines */}
            {selectedBenchmarks.map((benchmarkId) => {
              const benchmark = benchmarks.find((b) => b.id === benchmarkId);
              if (!benchmark) return null;
              return (
                <Line
                  key={benchmarkId}
                  type="monotone"
                  dataKey={benchmarkKeyMap[benchmarkId]}
                  name={benchmark.name}
                  stroke={benchmark.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
