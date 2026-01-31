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
  isBefore,
  subDays,
  subMonths,
  startOfYear,
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
  portfolioIndex: number | null;  // null for days before t0
  portfolioTL: number | null;
  gold?: number | null;
  usd?: number | null;
  eur?: number | null;
  bist100?: number | null;
  nasdaq100?: number | null;
  inflation_tr?: number | null;
}

/**
 * Calculate t0 from CLOSED trades only (earliest created_at among closed trades)
 * t0 = the opening date of the first trade that has been closed
 */
function calculateT0FromClosedTrades(closedTrades: Trade[]): Date | null {
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
function getTimeRangeDates(timeRange: TimeRange, today: Date): { startDate: Date; endDate: Date } {
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
    const pointValue = valueByDate.get(key); // O(1) instead of O(n)

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
 * Returns monthly map (yyyy-MM-dd format for first day of month)
 */
function convertInflationToCompoundIndex(
  monthlyRates: MarketSeriesPoint[],
  t0: Date,
  endDate?: Date
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
    
    // Add synthetic t0 month entry (startOfMonth format yyyy-MM-01)
    const syntheticT0Date = format(t0, 'yyyy-MM-01');
    result.set(syntheticT0Date, 100);
  }

  let index = 100;

  for (let i = t0Index; i < sortedRates.length; i++) {
    const rate = sortedRates[i].value;
    const dateKey = sortedRates[i].date.substring(0, 10);
    const monthKey = sortedRates[i].date.substring(0, 7);
    
    if (monthKey === t0Month) {
      // t0 month: index stays at 100 (no compounding applied)
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

// Value Panel Component
function ValuePanel({
  portfolioValue,
  benchmarkValues,
  inflationValue,
  benchmarks,
  selectedBenchmarks,
  hoveredDate,
}: {
  portfolioValue: number | null;
  benchmarkValues: Record<string, number | null>;
  inflationValue: number | null;
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
          {portfolioValue !== null ? portfolioValue.toFixed(1) : '-'}
        </div>
      </div>

      {/* Benchmarks */}
      {selectedBenchmarks
        .filter((id) => id !== 'inflation_tr')
        .map((id) => {
          const benchmark = benchmarks.find((b) => b.id === id);
          const value = benchmarkValues[id];
          if (!benchmark) return null;

          return (
            <div key={id}>
              <div className="text-xs text-muted-foreground">{benchmark.symbol}</div>
              <div
                className="text-sm font-semibold font-mono"
                style={{ color: benchmark.color }}
              >
                {value !== null && value !== undefined ? value.toFixed(1) : '-'}
              </div>
            </div>
          );
        })}

      {/* Inflation (special format) */}
      {selectedBenchmarks.includes('inflation_tr') && (
        <div>
          <div className="text-xs text-muted-foreground">Enflasyon</div>
          <div className="text-sm font-semibold font-mono text-orange-500">
            {inflationValue !== null && inflationValue > 0
              ? `100 → ${inflationValue.toFixed(0)} TL`
              : '-'}
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
    value: number | null;
    color: string;
    name: string;
  }>;
  label?: string;
  benchmarks: BenchmarkData[];
}) {
  if (!active || !payload?.length) return null;

  const portfolioEntry = payload.find((p) => p.dataKey === 'portfolioIndex');
  const portfolioValue = portfolioEntry?.value;
  
  // Don't show tooltip if portfolio value is null (before t0)
  if (portfolioValue === null || portfolioValue === undefined) return null;

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
        .filter((p) => p.dataKey !== 'portfolioIndex' && p.value !== null)
        .map((p) => {
          const value = p.value!;
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

  // Calculate t0 from CLOSED trades only (earliest created_at)
  const t0 = useMemo(
    () => calculateT0FromClosedTrades(closedTradesWithPositionAmount),
    [closedTradesWithPositionAmount]
  );

  // View window dates based on time range (recalculates when day changes)
  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    [timeRange, todayKey]
  );

  // STAGE A: Build full portfolio index from t0 to endDate (Map)
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

  // Get benchmark data and normalize from t0 (full range)
  const benchmarkDataMaps = useMemo(() => {
    const result: Record<string, Map<string, number>> = {};
    if (!t0) return result;

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        if (benchmarkId === 'inflation_tr') {
          // Get monthly map then convert to daily with carry-forward
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

  // STAGE B: Build view series from startDate to endDate
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

  // Calculate final values for the panel (find last non-null value)
  const finalValues = useMemo(() => {
    // Use hovered data if available, otherwise find last non-null portfolio value
    const source = hoveredData || (() => {
      for (let i = chartData.length - 1; i >= 0; i--) {
        if (chartData[i].portfolioIndex !== null) {
          return chartData[i];
        }
      }
      return null;
    })();

    if (!source || source.portfolioIndex === null) {
      return {
        portfolioValue: null as number | null,
        benchmarkValues: {} as Record<string, number | null>,
        inflationValue: null as number | null,
      };
    }

    const benchmarkValues: Record<string, number | null> = {};
    selectedBenchmarks
      .filter((id) => id !== 'inflation_tr')
      .forEach((id) => {
        const val = source[id as keyof ChartDataPoint] as number | null | undefined;
        benchmarkValues[id] = val ?? null;
      });

    return {
      portfolioValue: source.portfolioIndex,
      benchmarkValues,
      inflationValue: source.inflation_tr ?? null,
    };
  }, [chartData, hoveredData, selectedBenchmarks]);

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
              data={chartData}
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
              {/* Portfolio curve - NO connectNulls to skip null values */}
              <Line
                type="monotone"
                dataKey="portfolioIndex"
                name="Portföy"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
              {/* Benchmark lines - NO connectNulls to skip null values */}
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
