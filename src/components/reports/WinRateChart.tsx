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
import { TimeRange, BenchmarkData } from '@/types/trade';

interface WinRateChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
}

interface ChartDataPoint {
  date: string;
  winRate: number;
  gold: number;
  usd: number;
  eur: number;
  bist100: number;
  nasdaq: number;
}

// Generate mock data based on time range
function generateMockData(timeRange: TimeRange): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  let numPoints: number;
  
  switch (timeRange) {
    case '1w':
      numPoints = 7;
      break;
    case '1m':
      numPoints = 30;
      break;
    case '3m':
      numPoints = 12;
      break;
    case '6m':
      numPoints = 24;
      break;
    case '1y':
      numPoints = 12;
      break;
    default:
      numPoints = 30;
  }

  let winRate = 45 + Math.random() * 10;
  let gold = 100;
  let usd = 100;
  let eur = 100;
  let bist100 = 100;
  let nasdaq = 100;

  for (let i = 0; i < numPoints; i++) {
    // Simulate win rate changes
    winRate += (Math.random() - 0.4) * 5;
    winRate = Math.max(30, Math.min(80, winRate));

    // Simulate benchmark changes
    gold += (Math.random() - 0.45) * 3;
    usd += (Math.random() - 0.5) * 2;
    eur += (Math.random() - 0.48) * 2;
    bist100 += (Math.random() - 0.4) * 4;
    nasdaq += (Math.random() - 0.42) * 3;

    const date = new Date();
    if (timeRange === '1w') {
      date.setDate(date.getDate() - (numPoints - 1 - i));
    } else if (timeRange === '1m') {
      date.setDate(date.getDate() - (numPoints - 1 - i));
    } else {
      date.setMonth(date.getMonth() - (numPoints - 1 - i));
    }

    const dateLabel = timeRange === '1w' || timeRange === '1m'
      ? `${date.getDate()}/${date.getMonth() + 1}`
      : `${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;

    points.push({
      date: dateLabel,
      winRate: parseFloat(winRate.toFixed(1)),
      gold: parseFloat(gold.toFixed(1)),
      usd: parseFloat(usd.toFixed(1)),
      eur: parseFloat(eur.toFixed(1)),
      bist100: parseFloat(bist100.toFixed(1)),
      nasdaq: parseFloat(nasdaq.toFixed(1)),
    });
  }

  return points;
}

export function WinRateChart({ timeRange, selectedBenchmarks, benchmarks }: WinRateChartProps) {
  const data = useMemo(() => generateMockData(timeRange), [timeRange]);

  const benchmarkKeyMap: { [key: string]: keyof ChartDataPoint } = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq: 'nasdaq',
  };

  return (
    <div className="w-full h-[300px] sm:h-[400px]">
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
    </div>
  );
}
