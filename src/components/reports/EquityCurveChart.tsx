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
  eachDayOfInterval,
  startOfDay,
  addDays,
  differenceInDays,
  isAfter,
  isBefore,
  isEqual,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  filteredTrades: Trade[];
  startingCapital?: number;
}

interface EquityDataPoint {
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

// Calculate daily PnL contributions from closed trades (retroactive)
function calculateDailyPnLContributions(closedTrades: Trade[]): Map<string, number> {
  const dailyPnL = new Map<string, number>();

  for (const trade of closedTrades) {
    if (!trade.position_amount || !trade.exit_price || !trade.closed_at) continue;

    // Calculate total PnL
    const r = trade.trade_type === 'buy'
      ? (trade.exit_price - trade.entry_price) / trade.entry_price
      : (trade.entry_price - trade.exit_price) / trade.entry_price;
    const pnl = trade.position_amount * r;

    // Spread over duration
    const startDate = startOfDay(parseISO(trade.created_at));
    const endDate = startOfDay(parseISO(trade.closed_at));
    const days = differenceInDays(endDate, startDate) || 1;
    const dailyContribution = pnl / days;

    // Add contribution for each day (created_at included, closed_at excluded)
    let currentDay = startDate;
    while (isBefore(currentDay, endDate)) {
      const key = format(currentDay, 'yyyy-MM-dd');
      dailyPnL.set(key, (dailyPnL.get(key) || 0) + dailyContribution);
      currentDay = addDays(currentDay, 1);
    }
  }

  return dailyPnL;
}

// Find t0 (earliest trade start date)
function findT0(closedTrades: Trade[]): Date | null {
  if (closedTrades.length === 0) return null;

  return closedTrades.reduce((earliest, trade) => {
    const tradeStart = startOfDay(parseISO(trade.created_at));
    return tradeStart < earliest ? tradeStart : earliest;
  }, startOfDay(parseISO(closedTrades[0].created_at)));
}

// Generate retroactive equity curve
function generateRetroactiveEquityCurve(
  closedTrades: Trade[],
  startingCapital: number,
  t0: Date,
  endDate: Date
): { date: string; rawDate: string; portfolioTL: number; portfolioIndex: number }[] {
  const dailyPnL = calculateDailyPnLContributions(closedTrades);
  const days = eachDayOfInterval({ start: t0, end: endDate });

  let cumulative = startingCapital;
  return days.map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const dailyContribution = dailyPnL.get(key) || 0;
    cumulative += dailyContribution;

    return {
      date: format(day, 'd MMM', { locale: tr }),
      rawDate: key,
      portfolioTL: parseFloat(cumulative.toFixed(2)),
      portfolioIndex: parseFloat(((cumulative / startingCapital) * 100).toFixed(2)),
    };
  });
}

// Normalize benchmark data starting from t0 = 100
function normalizeBenchmarkFromT0(
  points: MarketSeriesPoint[],
  t0: Date
): MarketSeriesPoint[] {
  if (!points || points.length === 0) return [];

  // Sort points by date
  const sorted = [...points].sort((a, b) => 
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  // Find value at t0 (or closest after)
  let t0Value: number | null = null;
  const t0Key = format(t0, 'yyyy-MM-dd');
  
  for (const p of sorted) {
    const pDate = parseISO(p.date);
    if (isEqual(startOfDay(pDate), t0) || isAfter(pDate, t0)) {
      t0Value = p.value;
      break;
    }
  }

  // If no value at or after t0, use first available
  if (t0Value === null && sorted.length > 0) {
    t0Value = sorted[0].value;
  }

  if (!t0Value || t0Value === 0) return sorted;

  return sorted.map((p) => ({
    date: p.date,
    value: parseFloat(((p.value / t0Value!) * 100).toFixed(2)),
  }));
}

// Calculate compound inflation index (100 TL → X TL)
function calculateInflationIndex(
  monthlyRates: MarketSeriesPoint[],
  t0: Date
): MarketSeriesPoint[] {
  if (!monthlyRates || monthlyRates.length === 0) return [];

  // Sort by date
  const sorted = [...monthlyRates].sort((a, b) =>
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

  // Find starting index at t0
  let startIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const pDate = parseISO(sorted[i].date);
    if (isAfter(pDate, t0) || isEqual(startOfDay(pDate), startOfDay(t0))) {
      startIdx = i;
      break;
    }
  }

  // Calculate compound index from t0
  let index = 100;
  const result: MarketSeriesPoint[] = [];

  for (let i = startIdx; i < sorted.length; i++) {
    const monthlyRate = sorted[i].value; // Already a percentage (e.g., 2.5 means 2.5%)
    index = index * (1 + monthlyRate / 100);
    result.push({
      date: sorted[i].date,
      value: parseFloat(index.toFixed(2)),
    });
  }

  return result;
}

// Merge benchmark data into chart data
function mergeBenchmarkData(
  baseData: { date: string; rawDate: string; portfolioTL: number; portfolioIndex: number }[],
  benchmarkData: Record<MarketAsset, MarketSeriesPoint[]>,
  t0: Date
): EquityDataPoint[] {
  // Normalize each benchmark from t0
  const normalized: Record<string, MarketSeriesPoint[]> = {};

  for (const [asset, points] of Object.entries(benchmarkData)) {
    if (asset === 'inflation_tr') {
      normalized[asset] = calculateInflationIndex(points, t0);
    } else {
      normalized[asset] = normalizeBenchmarkFromT0(points, t0);
    }
  }

  const findLatestValue = (asset: string, targetIso: string): number | undefined => {
    const list = normalized[asset];
    if (!list || list.length === 0) return undefined;

    const target = parseISO(targetIso);
    let latest: number | undefined;
    for (const p of list) {
      if (isAfter(parseISO(p.date), target) && !isEqual(parseISO(p.date), target)) break;
      latest = p.value;
    }
    return latest;
  };

  return baseData.map((point) => {
    const result: EquityDataPoint = {
      date: point.date,
      rawDate: point.rawDate,
      portfolioIndex: point.portfolioIndex,
      portfolioTL: point.portfolioTL,
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

// Value Panel Component (right side)
interface ValuePanelProps {
  portfolioValue: number;
  portfolioTL: number;
  benchmarkValues: Record<string, number | undefined>;
  inflationValue?: number;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  startingCapital: number;
}

function ValuePanel({
  portfolioValue,
  portfolioTL,
  benchmarkValues,
  inflationValue,
  selectedBenchmarks,
  benchmarks,
  startingCapital,
}: ValuePanelProps) {
  const portfolioChange = portfolioValue - 100;
  const isProfit = portfolioChange >= 0;

  return (
    <div className="w-28 flex-shrink-0 border-l border-border pl-3 flex flex-col gap-3">
      {/* Portfolio */}
      <div>
        <div className="text-xs text-muted-foreground mb-1">Portföy</div>
        <div className={`text-lg font-bold font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
          {portfolioValue.toFixed(1)}
        </div>
        <div className={`text-xs font-mono ${isProfit ? 'text-profit' : 'text-loss'}`}>
          {isProfit ? '+' : ''}{portfolioChange.toFixed(1)}%
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-1">
          ₺{portfolioTL.toFixed(0)}
        </div>
      </div>

      {/* Benchmarks */}
      {selectedBenchmarks.map((benchmarkId) => {
        if (benchmarkId === 'inflation_tr') return null;
        
        const benchmark = benchmarks.find((b) => b.id === benchmarkId);
        const value = benchmarkValues[benchmarkId];
        if (!benchmark || value === undefined) return null;

        const diff = value - portfolioValue;
        const diffText = diff >= 0 
          ? `+${diff.toFixed(1)}` 
          : diff.toFixed(1);

        return (
          <div key={benchmarkId}>
            <div className="text-xs text-muted-foreground mb-1">{benchmark.symbol}</div>
            <div className="text-sm font-semibold font-mono" style={{ color: benchmark.color }}>
              {value.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">
              {diff >= 0 ? 'önde' : 'geride'}: {diffText}
            </div>
          </div>
        );
      })}

      {/* Inflation */}
      {selectedBenchmarks.includes('inflation_tr') && inflationValue !== undefined && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Enflasyon</div>
          <div className="text-sm font-semibold font-mono text-orange-500">
            100 → {inflationValue.toFixed(0)} ₺
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Tooltip Component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
  benchmarks: BenchmarkData[];
  startingCapital: number;
}

function CustomTooltip({ active, payload, label, benchmarks, startingCapital }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const portfolioPayload = payload.find((p) => p.dataKey === 'portfolioIndex');
  const portfolioValue = portfolioPayload?.value ?? 100;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <div className="text-sm font-semibold text-foreground mb-2">{label}</div>
      
      {/* Portfolio */}
      <div className="mb-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-primary font-semibold">Portföy</span>
          <span className={`font-mono font-semibold ${portfolioValue >= 100 ? 'text-profit' : 'text-loss'}`}>
            {portfolioValue.toFixed(1)} ({portfolioValue >= 100 ? '+' : ''}{(portfolioValue - 100).toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-2" />

      {/* Benchmarks */}
      {payload.filter((p) => p.dataKey !== 'portfolioIndex').map((item) => {
        const benchmark = benchmarks.find((b) => b.id === item.dataKey);
        const isInflation = item.dataKey === 'inflation_tr';
        
        if (isInflation) {
          return (
            <div key={item.dataKey} className="flex items-center justify-between gap-4 text-sm mb-1">
              <span className="text-orange-500">Enflasyon</span>
              <span className="font-mono text-orange-500">100 TL → {item.value.toFixed(0)} TL</span>
            </div>
          );
        }

        const diff = item.value - portfolioValue;
        const diffText = diff >= 0
          ? `portföyün %${diff.toFixed(1)} önünde`
          : `portföyün %${Math.abs(diff).toFixed(1)} gerisinde`;

        return (
          <div key={item.dataKey} className="mb-1">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: benchmark?.color }}>{benchmark?.name || item.dataKey}</span>
              <span className="font-mono" style={{ color: benchmark?.color }}>
                {item.value.toFixed(1)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{diffText}</div>
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
  filteredTrades,
  startingCapital = 1000,
}: EquityCurveChartProps) {
  const { getSeriesData, fetchSeries, isLoading } = useMarketSeries();
  const [hoveredData, setHoveredData] = useState<EquityDataPoint | null>(null);

  // Filter to only closed trades with position amounts
  const closedTradesWithAmount = useMemo(() => {
    return filteredTrades.filter(
      (t) => t.status === 'closed' && t.position_amount && t.exit_price && t.closed_at
    );
  }, [filteredTrades]);

  // Find t0 (earliest trade start)
  const t0 = useMemo(() => findT0(closedTradesWithAmount), [closedTradesWithAmount]);

  // Fetch data for selected benchmarks
  useEffect(() => {
    selectedBenchmarks.forEach((benchmarkId) => {
      fetchSeries(benchmarkId as MarketAsset);
    });
  }, [selectedBenchmarks, fetchSeries]);

  // Generate base equity curve data
  const baseData = useMemo(() => {
    if (!t0 || closedTradesWithAmount.length === 0) return [];
    return generateRetroactiveEquityCurve(closedTradesWithAmount, startingCapital, t0, new Date());
  }, [closedTradesWithAmount, startingCapital, t0]);

  // Get benchmark data (raw)
  const benchmarkSeriesData = useMemo(() => {
    const result: Record<MarketAsset, MarketSeriesPoint[]> = {} as Record<MarketAsset, MarketSeriesPoint[]>;

    selectedBenchmarks.forEach((benchmarkId) => {
      const seriesData = getSeriesData(benchmarkId as MarketAsset);
      if (seriesData?.points) {
        result[benchmarkId as MarketAsset] = seriesData.points;
      }
    });

    return result;
  }, [selectedBenchmarks, getSeriesData]);

  // Merge all data with normalization from t0
  const chartData = useMemo(() => {
    if (!t0 || baseData.length === 0) return [];
    return mergeBenchmarkData(baseData, benchmarkSeriesData, t0);
  }, [baseData, benchmarkSeriesData, t0]);

  // Check if any benchmark is loading
  const anyLoading = selectedBenchmarks.some((id) => isLoading(id as MarketAsset));

  // Check if there's any equity data
  const hasEquityData = closedTradesWithAmount.length > 0;

  // Get final values for the panel
  const finalData = hoveredData || (chartData.length > 0 ? chartData[chartData.length - 1] : null);
  const finalPortfolioIndex = finalData?.portfolioIndex ?? 100;
  const finalPortfolioTL = finalData?.portfolioTL ?? startingCapital;

  const benchmarkValues: Record<string, number | undefined> = {};
  selectedBenchmarks.forEach((id) => {
    benchmarkValues[id] = finalData?.[id as MarketAsset];
  });

  const inflationValue = finalData?.inflation_tr;

  const benchmarkKeyMap: { [key: string]: keyof EquityDataPoint } = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
  };

  return (
    <div className="w-full">
      <div className="flex">
        {/* Chart Area */}
        <div className="flex-1 h-[300px] sm:h-[400px]">
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
                  content={<CustomTooltip benchmarks={benchmarks} startingCapital={startingCapital} />}
                />
                {/* Reference line at 100 */}
                <ReferenceLine
                  y={100}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                {/* Portfolio line */}
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

        {/* Value Panel (right side) */}
        {hasEquityData && (
          <ValuePanel
            portfolioValue={finalPortfolioIndex}
            portfolioTL={finalPortfolioTL}
            benchmarkValues={benchmarkValues}
            inflationValue={inflationValue}
            selectedBenchmarks={selectedBenchmarks}
            benchmarks={benchmarks}
            startingCapital={startingCapital}
          />
        )}
      </div>
    </div>
  );
}
