import { useMemo, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TimeRange, BenchmarkData } from '@/types/trade';
import { MarketAsset, MarketSeriesPoint } from '@/types/market';
import { PortfolioSnapshot, RelativeChartPoint, CurrentValueData } from '@/types/portfolio';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { CurrentValuePanel } from './CurrentValuePanel';
import {
  format,
  parseISO,
  subMonths,
  subYears,
  startOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  startOfWeek,
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
  snapshots: PortfolioSnapshot[];
  isLoading?: boolean;
}

// Get cutoff date based on time range
function getCutoffDate(timeRange: TimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case '1m':
      return subMonths(now, 1);
    case '3m':
      return subMonths(now, 3);
    case '1y':
      return subYears(now, 1);
    case 'ytd':
      return startOfYear(now);
    default:
      return subMonths(now, 1);
  }
}

// Generate date intervals for the chart
function generateIntervals(timeRange: TimeRange): Date[] {
  const now = new Date();
  const start = getCutoffDate(timeRange);

  switch (timeRange) {
    case '1m':
      return eachDayOfInterval({ start, end: now });
    case '3m':
      return eachWeekOfInterval({ start: startOfWeek(start, { weekStartsOn: 1 }), end: now }, { weekStartsOn: 1 });
    case '1y':
    case 'ytd':
      return eachWeekOfInterval({ start: startOfWeek(start, { weekStartsOn: 1 }), end: now }, { weekStartsOn: 1 });
    default:
      return eachDayOfInterval({ start, end: now });
  }
}

// Find the latest value from a sorted array up to a target date
function findLatestValue(
  points: { date: Date; value: number }[],
  targetDate: Date
): number | undefined {
  let latest: number | undefined;
  for (const p of points) {
    if (isAfter(p.date, targetDate) && !isEqual(p.date, targetDate)) break;
    latest = p.value;
  }
  return latest;
}

// Find snapshot for a specific date (carry-forward)
function findSnapshotForDate(
  snapshots: PortfolioSnapshot[],
  targetDate: Date
): PortfolioSnapshot | undefined {
  let latest: PortfolioSnapshot | undefined;
  for (const s of snapshots) {
    const snapDate = parseISO(s.snapshot_date);
    if (isAfter(snapDate, targetDate) && !isEqual(snapDate, targetDate)) break;
    latest = s;
  }
  return latest;
}

// Calculate relative baseline chart data
function calculateRelativeData(
  snapshots: PortfolioSnapshot[],
  benchmarkData: Record<string, { date: Date; value: number }[]>,
  timeRange: TimeRange
): RelativeChartPoint[] {
  const intervals = generateIntervals(timeRange);
  const cutoffDate = getCutoffDate(timeRange);
  
  // Filter snapshots within range
  const filteredSnapshots = snapshots.filter(s => {
    const snapDate = parseISO(s.snapshot_date);
    return !isBefore(snapDate, cutoffDate);
  });

  if (filteredSnapshots.length === 0) return [];

  // Find start values
  const startSnapshot = findSnapshotForDate(snapshots, cutoffDate) || filteredSnapshots[0];
  const startUnitPrice = Number(startSnapshot.unit_price);

  const startBenchmarkPrices: Record<string, number> = {};
  for (const [asset, points] of Object.entries(benchmarkData)) {
    const startValue = findLatestValue(points, cutoffDate);
    if (startValue !== undefined) {
      startBenchmarkPrices[asset] = startValue;
    }
  }

  // Generate chart points
  return intervals.map((interval) => {
    const dateLabel = timeRange === '1m' 
      ? format(interval, 'd MMM', { locale: tr })
      : format(interval, 'd MMM', { locale: tr });
    const rawDate = format(interval, 'yyyy-MM-dd');

    // Find portfolio value for this date
    const snapshot = findSnapshotForDate(snapshots, interval);
    const currentUnitPrice = snapshot ? Number(snapshot.unit_price) : startUnitPrice;
    const portfolioReturnPct = ((currentUnitPrice / startUnitPrice) - 1) * 100;

    const result: RelativeChartPoint = {
      date: dateLabel,
      rawDate,
      portfolioReturnPct,
    };

    // Calculate relative diff for each benchmark
    for (const [asset, points] of Object.entries(benchmarkData)) {
      const startPrice = startBenchmarkPrices[asset];
      if (!startPrice) continue;

      const currentPrice = findLatestValue(points, interval);
      if (currentPrice === undefined) continue;

      const assetReturnPct = ((currentPrice / startPrice) - 1) * 100;
      // Relative difference: positive means asset outperformed portfolio
      result[asset as keyof RelativeChartPoint] = assetReturnPct - portfolioReturnPct;
    }

    return result;
  });
}

// Calculate inflation text "100 TL → X TL"
function calculateInflationText(
  benchmarkData: Record<string, { date: Date; value: number }[]>,
  timeRange: TimeRange
): string | null {
  const inflationPoints = benchmarkData['inflation_tr'];
  if (!inflationPoints || inflationPoints.length === 0) return null;

  const cutoffDate = getCutoffDate(timeRange);
  const now = new Date();

  const startValue = findLatestValue(inflationPoints, cutoffDate);
  const endValue = findLatestValue(inflationPoints, now);

  if (!startValue || !endValue) return null;

  const factor = endValue / startValue;
  const resultValue = Math.round(100 * factor);

  return `100 TL → ${resultValue} TL`;
}

export function EquityCurveChart({
  timeRange,
  selectedBenchmarks,
  benchmarks,
  snapshots,
  isLoading: portfolioLoading = false,
}: EquityCurveChartProps) {
  const { getSeriesData, fetchSeries, isLoading: isMarketLoading, filterByTimeRange } = useMarketSeries();
  const [hoveredData, setHoveredData] = useState<CurrentValueData | null>(null);

  // Fetch data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((benchmarkId) => {
      fetchSeries(benchmarkId as MarketAsset);
    });
    // Always fetch inflation for the side panel text
    fetchSeries('inflation_tr');
  }, [selectedBenchmarks, fetchSeries]);

  // Prepare benchmark data
  const benchmarkSeriesData = useMemo(() => {
    const result: Record<string, { date: Date; value: number }[]> = {};
    const allBenchmarks = [...new Set([...selectedBenchmarks, 'inflation_tr'])];

    allBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        const filtered = filterByTimeRange(seriesData.points, timeRange);
        result[benchmarkId] = filtered
          .map((p) => ({ date: parseISO(p.date), value: p.value }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
      }
    });

    return result;
  }, [selectedBenchmarks, getSeriesData, timeRange, filterByTimeRange]);

  // Calculate chart data with relative baseline
  const chartData = useMemo(() => {
    if (snapshots.length === 0) return [];
    return calculateRelativeData(snapshots, benchmarkSeriesData, timeRange);
  }, [snapshots, benchmarkSeriesData, timeRange]);

  // Current value data for side panel
  const currentValueData = useMemo((): CurrentValueData | null => {
    if (hoveredData) return hoveredData;
    if (chartData.length === 0 || snapshots.length === 0) return null;

    const lastPoint = chartData[chartData.length - 1];
    const latestSnapshot = snapshots[snapshots.length - 1];

    const benchmarkDiffs: Record<string, number> = {};
    selectedBenchmarks.forEach((id) => {
      const value = lastPoint[id as keyof RelativeChartPoint];
      if (typeof value === 'number') {
        benchmarkDiffs[id] = value;
      }
    });

    return {
      date: format(new Date(), 'd MMMM yyyy', { locale: tr }),
      unitPrice: Number(latestSnapshot.unit_price),
      portfolioReturnPct: lastPoint.portfolioReturnPct,
      benchmarkDiffs,
      inflationText: calculateInflationText(benchmarkSeriesData, timeRange),
    };
  }, [chartData, snapshots, hoveredData, selectedBenchmarks, benchmarkSeriesData, timeRange]);

  // Handle tooltip hover
  const handleTooltipHover = (data: RelativeChartPoint | null, snapshot: PortfolioSnapshot | null) => {
    if (!data || !snapshot) {
      setHoveredData(null);
      return;
    }

    const benchmarkDiffs: Record<string, number> = {};
    selectedBenchmarks.forEach((id) => {
      const value = data[id as keyof RelativeChartPoint];
      if (typeof value === 'number') {
        benchmarkDiffs[id] = value;
      }
    });

    setHoveredData({
      date: format(parseISO(data.rawDate), 'd MMMM yyyy', { locale: tr }),
      unitPrice: Number(snapshot.unit_price),
      portfolioReturnPct: data.portfolioReturnPct,
      benchmarkDiffs,
      inflationText: calculateInflationText(benchmarkSeriesData, timeRange),
    });
  };

  const anyLoading = portfolioLoading || selectedBenchmarks.some((id) => isMarketLoading(id as MarketAsset));
  const hasData = snapshots.length > 0;

  const benchmarkKeyMap: Record<string, keyof RelativeChartPoint> = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;

    const dataPoint = chartData.find((d) => d.date === label);
    if (!dataPoint) return null;

    const snapshot = findSnapshotForDate(snapshots, parseISO(dataPoint.rawDate));

    // Update side panel on hover
    if (snapshot) {
      // Trigger side panel update (we use effect for this)
    }

    const portfolioValue = payload.find((p) => p.dataKey === 'portfolioBaseline');

    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        
        <div className="space-y-1">
          {/* Portfolio return */}
          {dataPoint && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Portföy</span>
              <span className={`text-sm font-mono font-semibold ${
                dataPoint.portfolioReturnPct >= 0 ? 'text-profit' : 'text-loss'
              }`}>
                {dataPoint.portfolioReturnPct >= 0 ? '+' : ''}{dataPoint.portfolioReturnPct.toFixed(1)}%
              </span>
            </div>
          )}

          {/* Benchmark diffs */}
          {payload
            .filter((p) => p.dataKey !== 'portfolioBaseline')
            .map((entry) => {
              const benchmark = benchmarks.find((b) => benchmarkKeyMap[b.id] === entry.dataKey);
              const isInflation = entry.dataKey === 'inflation_tr';
              
              return (
                <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-muted-foreground">
                      {benchmark?.name || (isInflation ? 'Enflasyon' : entry.dataKey)}
                    </span>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${
                    entry.value > 0 ? 'text-profit' : entry.value < 0 ? 'text-loss' : 'text-muted-foreground'
                  }`}>
                    {entry.value > 0 ? '+' : ''}{entry.value.toFixed(1)}%
                  </span>
                </div>
              );
            })}
        </div>

        {/* Net difference text */}
        {selectedBenchmarks.length > 0 && dataPoint && (
          <div className="mt-2 pt-2 border-t border-border">
            {selectedBenchmarks.map((id) => {
              const diff = dataPoint[id as keyof RelativeChartPoint];
              if (typeof diff !== 'number') return null;
              const benchmark = benchmarks.find((b) => b.id === id);
              if (!benchmark) return null;

              const isAhead = diff > 0;
              return (
                <p key={id} className="text-xs text-muted-foreground">
                  {isAhead 
                    ? `${benchmark.name}'ın %${Math.abs(diff).toFixed(1)} gerisinde`
                    : `${benchmark.name}'ı %${Math.abs(diff).toFixed(1)} geçtiniz`
                  }
                </p>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-4">
      {/* Chart */}
      <div className="flex-1">
        <div className="h-[300px] sm:h-[400px]">
          {anyLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Skeleton className="w-full h-full" />
            </div>
          ) : !hasData ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground text-sm mb-2">
                  Henüz portföy verisi yok
                </p>
                <p className="text-xs text-muted-foreground">
                  💡 "Nakit Ekle" butonuyla portföyünüze para ekleyerek başlayın
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartData} 
                margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
                onMouseLeave={() => setHoveredData(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}%`}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Zero baseline (Portfolio) */}
                <ReferenceLine 
                  y={0} 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  label={{ 
                    value: 'Portföy', 
                    position: 'right',
                    fill: 'hsl(var(--primary))',
                    fontSize: 11,
                  }}
                />

                {/* Invisible line for portfolio tooltip */}
                <Line
                  type="monotone"
                  dataKey={() => 0}
                  name="portfolioBaseline"
                  stroke="transparent"
                  dot={false}
                  activeDot={false}
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
                      dot={false}
                      activeDot={{ r: 4, fill: benchmark.color }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Side Panel */}
      <CurrentValuePanel
        data={currentValueData}
        selectedBenchmarks={selectedBenchmarks}
        benchmarks={benchmarks}
        isLoading={anyLoading}
      />
    </div>
  );
}
