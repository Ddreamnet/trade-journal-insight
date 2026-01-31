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
import { TimeRange, BenchmarkData, Trade } from '@/types/trade';
import { MarketAsset, MarketSeriesPoint } from '@/types/market';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import {
  format,
  parseISO,
  startOfDay,
  addDays,
  differenceInDays,
  isAfter,
  isBefore,
  isEqual,
  subDays,
  subMonths,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  allTrades: Trade[];
  closedTrades: Trade[];
  startingCapital: number;
}

interface ChartDataPoint {
  date: string;
  rawDate: string;
  portfolioIndex: number;
  portfolioTL: number;
  gold?: number;
  usd?: number;
  eur?: number;
  bist100?: number;
  nasdaq100?: number;
  inflation_tr?: number;
}

// Calculate t0 from ALL trades (not just closed)
function calculateT0(allTrades: Trade[]): Date | null {
  if (allTrades.length === 0) return null;
  
  return allTrades.reduce((earliest, trade) => {
    const d = startOfDay(parseISO(trade.created_at));
    return d < earliest ? d : earliest;
  }, startOfDay(parseISO(allTrades[0].created_at)));
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
function normalizeBenchmarkFromT0WithCarryForward(
  points: MarketSeriesPoint[],
  t0: Date,
  endDate: Date
): Map<string, number> {
  const result = new Map<string, number>();
  if (!points || points.length === 0) return result;

  const t0Value = findValueAtDateWithCarryForward(points, t0);
  if (!t0Value) return result;

  const sorted = [...points].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  let lastKnownValue = t0Value;
  let currentDay = t0;

  while (currentDay <= endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    const pointValue = sorted.find((p) => p.date === key)?.value;

    if (pointValue !== undefined) {
      lastKnownValue = pointValue;
    }

    result.set(key, 100 * (lastKnownValue / t0Value));
    currentDay = addDays(currentDay, 1);
  }

  return result;
}

// Convert inflation monthly rates to compound index starting from t0
function convertInflationToCompoundIndex(
  monthlyRates: MarketSeriesPoint[],
  t0: Date
): Map<string, number> {
  const result = new Map<string, number>();
  if (!monthlyRates || monthlyRates.length === 0) return result;

  const sortedRates = [...monthlyRates].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  const t0Month = format(t0, 'yyyy-MM');
  const t0Index = sortedRates.findIndex((r) => r.date.startsWith(t0Month));
  
  if (t0Index === -1) return result;

  let index = 100;

  for (let i = t0Index; i < sortedRates.length; i++) {
    const rate = sortedRates[i].value;
    if (i > t0Index) {
      index = index * (1 + rate / 100);
    }
    // Store with the date (first of month)
    result.set(sortedRates[i].date.substring(0, 10), parseFloat(index.toFixed(2)));
  }

  return result;
}

// Get time range cutoff
function getTimeRangeCutoff(timeRange: TimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case '1w':
      return subDays(now, 7);
    case '1m':
      return subMonths(now, 1);
    case '3m':
      return subMonths(now, 3);
    case '6m':
      return subMonths(now, 6);
    case '1y':
      return subMonths(now, 12);
    case '3y':
      return subMonths(now, 36);
    default:
      return subMonths(now, 1);
  }
}

// Value Panel Component
function ValuePanel({
  portfolioValue,
  benchmarkValues,
  inflationValue,
  benchmarks,
  selectedBenchmarks,
  hoveredDate,
}: {
  portfolioValue: number;
  benchmarkValues: Record<string, number>;
  inflationValue: number;
  benchmarks: BenchmarkData[];
  selectedBenchmarks: string[];
  hoveredDate?: string;
}) {
  return (
    <div className="w-28 shrink-0 border-l border-border pl-3 flex flex-col gap-3">
      {hoveredDate && (
        <div className="text-xs text-muted-foreground mb-1">
          {hoveredDate}
        </div>
      )}
      
      {/* Portfolio */}
      <div>
        <div className="text-xs text-muted-foreground">Portföy</div>
        <div className="text-lg font-bold text-primary font-mono">
          {portfolioValue.toFixed(1)}
        </div>
      </div>

      {/* Benchmarks */}
      {selectedBenchmarks
        .filter((id) => id !== 'inflation_tr')
        .map((id) => {
          const benchmark = benchmarks.find((b) => b.id === id);
          const value = benchmarkValues[id];
          if (!benchmark || value === undefined) return null;

          return (
            <div key={id}>
              <div className="text-xs text-muted-foreground">{benchmark.symbol}</div>
              <div
                className="text-sm font-semibold font-mono"
                style={{ color: benchmark.color }}
              >
                {value.toFixed(1)}
              </div>
            </div>
          );
        })}

      {/* Inflation (special format) */}
      {selectedBenchmarks.includes('inflation_tr') && inflationValue > 0 && (
        <div>
          <div className="text-xs text-muted-foreground">Enflasyon</div>
          <div className="text-sm font-semibold font-mono text-orange-500">
            100 → {inflationValue.toFixed(0)} TL
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Tooltip
function CustomTooltip({
  active,
  payload,
  label,
  benchmarks,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
  benchmarks: BenchmarkData[];
}) {
  if (!active || !payload?.length) return null;

  const portfolioEntry = payload.find((p) => p.dataKey === 'portfolioIndex');
  const portfolioValue = portfolioEntry?.value ?? 100;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <div className="font-medium mb-2 text-foreground">{label}</div>

      {/* Portfolio */}
      <div className="flex justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Portföy:</span>
        <span className="font-mono font-semibold text-primary">
          {portfolioValue.toFixed(1)}
        </span>
      </div>

      {payload.length > 1 && <hr className="my-2 border-border" />}

      {/* Benchmarks with difference */}
      {payload
        .filter((p) => p.dataKey !== 'portfolioIndex')
        .map((p) => {
          const value = p.value;
          const diff = ((value / portfolioValue) - 1) * 100;
          const diffText =
            diff >= 0
              ? `portföyün %${diff.toFixed(1)} önünde`
              : `portföyün %${Math.abs(diff).toFixed(1)} gerisinde`;

          const isInflation = p.dataKey === 'inflation_tr';

          return (
            <div key={p.dataKey} className="text-sm mb-1">
              <div className="flex justify-between gap-4">
                <span style={{ color: p.color }}>{p.name}:</span>
                <span className="font-mono">
                  {isInflation
                    ? `100 → ${value.toFixed(0)} TL`
                    : value.toFixed(1)}
                </span>
              </div>
              {!isInflation && (
                <div className="text-xs text-muted-foreground">{diffText}</div>
              )}
            </div>
          );
        })}
    </div>
  );
}

export function EquityCurveChart({
  timeRange,
  selectedBenchmarks,
  benchmarks,
  allTrades,
  closedTrades,
  startingCapital,
}: EquityCurveChartProps) {
  const { getSeriesData, fetchSeries, isLoading } = useMarketSeries();
  const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null);

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

  // Calculate t0 from ALL trades
  const t0 = useMemo(() => calculateT0(allTrades), [allTrades]);

  // Time range cutoff
  const cutoffDate = useMemo(() => getTimeRangeCutoff(timeRange), [timeRange]);

  // Generate chart data
  const chartData = useMemo(() => {
    if (!t0 || closedTradesWithPositionAmount.length === 0) return [];

    const today = startOfDay(new Date());
    const dailyPnL = calculateDailyPnLContributions(closedTradesWithPositionAmount);

    // Build portfolio curve from t0 to today
    const data: ChartDataPoint[] = [];
    let cumulativeTL = startingCapital;
    let currentDay = t0;

    while (currentDay <= today) {
      const key = format(currentDay, 'yyyy-MM-dd');
      const dailyContribution = dailyPnL.get(key) || 0;
      cumulativeTL += dailyContribution;

      data.push({
        date: format(currentDay, 'd MMM', { locale: tr }),
        rawDate: key,
        portfolioTL: cumulativeTL,
        portfolioIndex: 100 * (cumulativeTL / startingCapital),
      });

      currentDay = addDays(currentDay, 1);
    }

    // Filter by time range
    const filtered = data.filter((point) => {
      const pointDate = parseISO(point.rawDate);
      return isAfter(pointDate, cutoffDate) || isEqual(pointDate, startOfDay(cutoffDate));
    });

    return filtered;
  }, [t0, closedTradesWithPositionAmount, startingCapital, cutoffDate]);

  // Get benchmark data and normalize from t0
  const benchmarkDataMaps = useMemo(() => {
    if (!t0) return {};

    const today = startOfDay(new Date());
    const result: Record<string, Map<string, number>> = {};

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        if (benchmarkId === 'inflation_tr') {
          result[benchmarkId] = convertInflationToCompoundIndex(seriesData.points, t0);
        } else {
          result[benchmarkId] = normalizeBenchmarkFromT0WithCarryForward(
            seriesData.points,
            t0,
            today
          );
        }
      }
    });

    return result;
  }, [selectedBenchmarks, getSeriesData, t0]);

  // Merge benchmark data into chart data
  const mergedChartData = useMemo(() => {
    if (chartData.length === 0) return [];

    return chartData.map((point) => {
      const merged: ChartDataPoint = { ...point };

      for (const [benchmarkId, dataMap] of Object.entries(benchmarkDataMaps)) {
        if (benchmarkId === 'inflation_tr') {
          // For inflation, find the matching month
          const pointMonth = point.rawDate.substring(0, 7);
          for (const [dateKey, value] of dataMap.entries()) {
            if (dateKey.startsWith(pointMonth)) {
              merged.inflation_tr = value;
              break;
            }
          }
        } else {
          const value = dataMap.get(point.rawDate);
          if (value !== undefined) {
            switch (benchmarkId) {
              case 'gold':
                merged.gold = value;
                break;
              case 'usd':
                merged.usd = value;
                break;
              case 'eur':
                merged.eur = value;
                break;
              case 'bist100':
                merged.bist100 = value;
                break;
              case 'nasdaq100':
                merged.nasdaq100 = value;
                break;
            }
          }
        }
      }

      return merged;
    });
  }, [chartData, benchmarkDataMaps]);

  // Calculate final values for the panel
  const finalValues = useMemo(() => {
    const source = hoveredData || (mergedChartData.length > 0 ? mergedChartData[mergedChartData.length - 1] : null);
    
    if (!source) {
      return {
        portfolioValue: 100,
        benchmarkValues: {} as Record<string, number>,
        inflationValue: 100,
      };
    }

    const benchmarkValues: Record<string, number> = {};
    selectedBenchmarks
      .filter((id) => id !== 'inflation_tr')
      .forEach((id) => {
        const val = source[id as keyof ChartDataPoint] as number | undefined;
        if (val !== undefined) {
          benchmarkValues[id] = val;
        }
      });

    return {
      portfolioValue: source.portfolioIndex,
      benchmarkValues,
      inflationValue: source.inflation_tr ?? 100,
    };
  }, [mergedChartData, hoveredData, selectedBenchmarks]);

  // Check if any benchmark is loading
  const anyLoading = selectedBenchmarks.some((id) => isLoading(id as MarketAsset));

  // Benchmark key map
  const benchmarkKeyMap: Record<string, keyof ChartDataPoint> = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
  };

  // Empty state: no closed trades with position amount
  if (closedTradesWithPositionAmount.length === 0) {
    return (
      <div className="w-full h-[300px] sm:h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-2">
            Henüz kapanmış işlem bulunmuyor
          </p>
          <p className="text-xs text-muted-foreground">
            İşlemler kapandığında grafik burada görünecek
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex gap-4">
      {/* Chart Area */}
      <div className="flex-1 h-[300px] sm:h-[400px]">
        {anyLoading && selectedBenchmarks.length > 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton className="w-full h-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={mergedChartData}
              margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              onMouseMove={(state) => {
                if (state?.activePayload?.[0]?.payload) {
                  setHoveredData(state.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => setHoveredData(null)}
            >
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
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={<CustomTooltip benchmarks={benchmarks} />}
              />
              {/* Reference line at 100 */}
              <ReferenceLine
                y={100}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              {/* Portfolio curve */}
              <Line
                type="monotone"
                dataKey="portfolioIndex"
                name="Portföy"
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

      {/* Value Panel */}
      <ValuePanel
        portfolioValue={finalValues.portfolioValue}
        benchmarkValues={finalValues.benchmarkValues}
        inflationValue={finalValues.inflationValue}
        benchmarks={benchmarks}
        selectedBenchmarks={selectedBenchmarks}
        hoveredDate={hoveredData?.date}
      />
    </div>
  );
}
