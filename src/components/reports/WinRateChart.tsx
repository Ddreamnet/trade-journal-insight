import { useMemo } from 'react';
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
import { format, parseISO, subDays, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

interface WinRateChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  filteredTrades: Trade[];
}

interface ChartDataPoint {
  date: string;
  winRate: number | null;
  gold: number;
  usd: number;
  eur: number;
  bist100: number;
  nasdaq: number;
}

// Generate chart data based on filtered trades
function generateChartData(filteredTrades: Trade[], timeRange: TimeRange): ChartDataPoint[] {
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
      intervals = eachWeekOfInterval({ start: subMonths(now, 3), end: now });
      groupBy = 'week';
      break;
    case '6m':
      intervals = eachWeekOfInterval({ start: subMonths(now, 6), end: now });
      groupBy = 'week';
      break;
    case '1y':
      intervals = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
      groupBy = 'month';
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

  // Random benchmark values (mock - will be replaced with API later)
  let gold = 100;
  let usd = 100;
  let eur = 100;
  let bist100 = 100;
  let nasdaq = 100;

  return intervals.map((interval) => {
    let key: string;
    let dateLabel: string;

    if (groupBy === 'day') {
      key = format(interval, 'yyyy-MM-dd');
      dateLabel = format(interval, 'd MMM', { locale: tr });
    } else if (groupBy === 'week') {
      key = format(startOfWeek(interval, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      dateLabel = format(interval, 'd MMM', { locale: tr });
    } else {
      key = format(interval, 'yyyy-MM');
      dateLabel = format(interval, 'MMM yy', { locale: tr });
    }

    const tradesInInterval = tradesByInterval.get(key) || [];
    cumulativeTotal += tradesInInterval.length;
    cumulativeSuccess += tradesInInterval.filter((t) => t.is_successful).length;

    const winRate = cumulativeTotal > 0 ? (cumulativeSuccess / cumulativeTotal) * 100 : null;

    // Simulate benchmark changes (mock data)
    gold += (Math.random() - 0.45) * 3;
    usd += (Math.random() - 0.5) * 2;
    eur += (Math.random() - 0.48) * 2;
    bist100 += (Math.random() - 0.4) * 4;
    nasdaq += (Math.random() - 0.42) * 3;

    return {
      date: dateLabel,
      winRate: winRate !== null ? parseFloat(winRate.toFixed(1)) : null,
      gold: parseFloat(gold.toFixed(1)),
      usd: parseFloat(usd.toFixed(1)),
      eur: parseFloat(eur.toFixed(1)),
      bist100: parseFloat(bist100.toFixed(1)),
      nasdaq: parseFloat(nasdaq.toFixed(1)),
    };
  });
}

export function WinRateChart({ timeRange, selectedBenchmarks, benchmarks, filteredTrades }: WinRateChartProps) {
  const data = useMemo(() => generateChartData(filteredTrades, timeRange), [filteredTrades, timeRange]);

  const benchmarkKeyMap: { [key: string]: keyof ChartDataPoint } = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq: 'nasdaq',
  };

  // Check if there's any winrate data
  const hasWinRateData = data.some((d) => d.winRate !== null);

  return (
    <div className="w-full h-[300px] sm:h-[400px]">
      {!hasWinRateData && filteredTrades.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Bu dönemde kapatılmış işlem bulunmuyor
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
                if (value === null) return ['Veri yok', name];
                return [name === 'Win Rate %' ? `%${value}` : value, name];
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
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}