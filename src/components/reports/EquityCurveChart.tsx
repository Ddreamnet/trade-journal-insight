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
  ReferenceLine,
} from 'recharts';
import { TimeRange, BenchmarkData, Trade } from '@/types/trade';
import { MarketAsset, MarketSeriesPoint } from '@/types/market';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import {
  format,
  parseISO,
  subDays,
  subMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfDay,
  startOfWeek,
  startOfMonth,
  isAfter,
  isEqual,
  isBefore,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  filteredTrades: Trade[];
  startingBalance?: number;
}

interface ChartDataPoint {
  date: string;
  rawDate: string;
  balance: number | null;
  gold?: number;
  usd?: number;
  eur?: number;
  bist100?: number;
  nasdaq100?: number;
  inflation_tr?: number;
}

// Calculate PnL for a trade
function calculateTradePnL(trade: Trade): number {
  if (!trade.exit_price || !trade.position_amount) return 0;
  
  const entry = trade.entry_price;
  const exit = trade.exit_price;
  const positionAmount = trade.position_amount;
  
  let returnPercent: number;
  
  if (trade.trade_type === 'buy') {
    // Long: profit if exit > entry
    returnPercent = (exit - entry) / entry;
  } else {
    // Short: profit if exit < entry
    returnPercent = (entry - exit) / entry;
  }
  
  return positionAmount * returnPercent;
}

// Generate equity curve data based on filtered trades
function generateEquityCurveData(filteredTrades: Trade[], timeRange: TimeRange, startingBalance: number) {
  const now = new Date();
  let intervals: Date[];
  let groupBy: 'day' | 'week' | 'month';

  switch (timeRange) {
    case '1w':
      intervals = eachDayOfInterval({ start: subDays(now, 6), end: now });
      groupBy = 'day';
      break;
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
    case '6m':
      intervals = eachWeekOfInterval(
        {
          start: startOfWeek(subMonths(now, 6), { weekStartsOn: 1 }),
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
    case '3y':
      intervals = eachMonthOfInterval({ start: subMonths(now, 35), end: now });
      groupBy = 'month';
      break;
    default:
      intervals = eachDayOfInterval({ start: subDays(now, 29), end: now });
      groupBy = 'day';
  }

  // Sort trades by closed_at
  const sortedTrades = [...filteredTrades]
    .filter((t) => t.closed_at && t.position_amount)
    .sort((a, b) => {
      const dateA = parseISO(a.closed_at!);
      const dateB = parseISO(b.closed_at!);
      return dateA.getTime() - dateB.getTime();
    });

  // Group trades by interval and calculate cumulative PnL
  const tradesByInterval = new Map<string, Trade[]>();

  sortedTrades.forEach((trade) => {
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

  // Calculate cumulative balance
  let cumulativeBalance = startingBalance;

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
    
    // Calculate PnL for this interval
    const intervalPnL = tradesInInterval.reduce((sum, trade) => {
      return sum + calculateTradePnL(trade);
    }, 0);
    
    cumulativeBalance += intervalPnL;

    return {
      date: dateLabel,
      rawDate,
      balance: parseFloat(cumulativeBalance.toFixed(2)),
    };
  });
}

// Merge benchmark data into chart data
function mergeBenchmarkData(
  baseData: { date: string; rawDate: string; balance: number | null }[],
  benchmarkData: Record<MarketAsset, MarketSeriesPoint[]>
): ChartDataPoint[] {
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
      balance: point.balance,
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

export function EquityCurveChart({ 
  timeRange, 
  selectedBenchmarks, 
  benchmarks, 
  filteredTrades,
  startingBalance = 100,
}: EquityCurveChartProps) {
  const { getSeriesData, fetchSeries, isLoading, filterByTimeRange, normalizeData } = useMarketSeries();

  // Fetch data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((benchmarkId) => {
      fetchSeries(benchmarkId as MarketAsset);
    });
  }, [selectedBenchmarks, fetchSeries]);

  // Generate base equity curve data
  const baseData = useMemo(
    () => generateEquityCurveData(filteredTrades, timeRange, startingBalance),
    [filteredTrades, timeRange, startingBalance]
  );

  // Get and process benchmark data
  const benchmarkSeriesData = useMemo(() => {
    const result: Record<MarketAsset, MarketSeriesPoint[]> = {} as Record<MarketAsset, MarketSeriesPoint[]>;

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
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

  // Check if there's any equity data with position amounts
  const hasEquityData = filteredTrades.some((t) => t.position_amount && t.closed_at);
  
  // Calculate final balance for display
  const finalBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : startingBalance;
  const totalChange = finalBalance !== null ? finalBalance - startingBalance : 0;
  const totalChangePercent = ((totalChange / startingBalance) * 100).toFixed(1);

  const benchmarkKeyMap: { [key: string]: keyof ChartDataPoint } = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
  };

  return (
    <div className="w-full">
      {/* Summary */}
      {hasEquityData && (
        <div className="mb-4 p-3 rounded-lg bg-secondary/50 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Başlangıç: <span className="font-mono font-semibold text-foreground">₺{startingBalance}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Son:</span>
            <span className="font-mono font-semibold text-foreground">
              ₺{finalBalance?.toFixed(2)}
            </span>
            <span className={`font-mono text-sm font-semibold ${totalChange >= 0 ? 'text-profit' : 'text-loss'}`}>
              ({totalChange >= 0 ? '+' : ''}{totalChangePercent}%)
            </span>
          </div>
        </div>
      )}

      <div className="h-[300px] sm:h-[400px]">
        {anyLoading && selectedBenchmarks.length > 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        ) : !hasEquityData ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-2">
                Equity grafiği için işlem tutarı girilen kapatılmış işlem bulunmuyor
              </p>
              <p className="text-xs text-muted-foreground">
                💡 İşlem açarken "İşlem Tutarı" alanını doldurun
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
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
                tickFormatter={(value) => `₺${value}`}
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
                  if (name === 'Bakiye') return [`₺${value.toFixed(2)}`, name];
                  return [value.toFixed(2), name];
                }}
              />
              <Legend />
              {/* Reference line at starting balance */}
              <ReferenceLine 
                y={startingBalance} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              {/* Equity curve */}
              <Line
                type="monotone"
                dataKey="balance"
                name="Bakiye"
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
    </div>
  );
}
