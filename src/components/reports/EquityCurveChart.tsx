import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeRange, BenchmarkData, Trade } from '@/types/trade';
import {
  useEquityCurveData,
  ChartDataPoint,
  PartialCloseRecord,
  getTimeRangeDates,
} from '@/hooks/useEquityCurveData';
import { useStockPriceSeries } from '@/hooks/useStockPriceSeries';

interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  allTrades: Trade[];
  closedTrades: Trade[];
  startingCapital: number;
  partialCloses: PartialCloseRecord[];
  height?: number;
}

/**
 * Tooltip — design-system surface, concise.
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number | null;
    color: string;
    name: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const portfolioEntry = payload.find((p) => p.dataKey === 'portfolioIndex');
  const portfolioValue = portfolioEntry?.value;
  if (portfolioValue === null || portfolioValue === undefined) return null;
  const portfolioDelta = portfolioValue - 100;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/95 backdrop-blur-md px-3 py-2.5 shadow-lg min-w-[180px]">
      <div className="text-caption text-muted-foreground mb-1.5">{label}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-label text-foreground">Portföy</span>
        <span
          className={cn(
            'num-sm font-semibold',
            portfolioDelta >= 0 ? 'text-profit' : 'text-loss'
          )}
        >
          {portfolioValue.toFixed(1)}
          <span className="text-muted-foreground ml-1">
            ({portfolioDelta >= 0 ? '+' : ''}
            {portfolioDelta.toFixed(1)}%)
          </span>
        </span>
      </div>

      {payload.length > 1 && (
        <div className="mt-2 pt-2 border-t border-border-subtle space-y-1">
          {payload
            .filter((p) => p.dataKey !== 'portfolioIndex' && p.value !== null)
            .map((p) => {
              const value = p.value!;
              const delta = value - 100;
              return (
                <div
                  key={p.dataKey}
                  className="flex items-center justify-between gap-4"
                >
                  <span
                    className="text-label inline-flex items-center gap-1.5"
                    style={{ color: p.color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </span>
                  <span
                    className={cn(
                      'num-sm',
                      delta >= 0 ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}%
                  </span>
                </div>
              );
            })}
        </div>
      )}
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
  partialCloses,
  height = 320,
}: EquityCurveChartProps) {
  const [scrub, setScrub] = useState<ChartDataPoint | null>(null);

  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    [timeRange]
  );

  const { priceMap: stockPriceMap, missingSymbols } = useStockPriceSeries(
    allTrades,
    startDate,
    endDate
  );

  const { chartData } = useEquityCurveData(
    timeRange,
    selectedBenchmarks,
    closedTrades,
    startingCapital,
    partialCloses,
    allTrades,
    stockPriceMap,
    missingSymbols
  );

  const hasTrades = useMemo(
    () => allTrades.length > 0 || closedTrades.some((t) => t.closed_at),
    [allTrades, closedTrades]
  );

  const benchmarkKeyMap: Record<string, keyof ChartDataPoint> = useMemo(
    () => ({
      gold: 'gold',
      silver: 'silver',
      usd: 'usd',
      eur: 'eur',
      bist100: 'bist100',
      nasdaq100: 'nasdaq100',
      inflation_tr: 'inflation_tr',
      btcusdt: 'btcusdt',
    }),
    []
  );

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return ['auto', 'auto'] as const;
    const visibleKeys: (keyof ChartDataPoint)[] = ['portfolioIndex'];
    selectedBenchmarks.forEach((id) => {
      const key = benchmarkKeyMap[id];
      if (key) visibleKeys.push(key);
    });
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((point) => {
      visibleKeys.forEach((key) => {
        const val = point[key] as number | null | undefined;
        if (val !== null && val !== undefined) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      });
    });
    if (!isFinite(min) || !isFinite(max)) return ['auto', 'auto'] as const;
    const range = max - min;
    const padding = Math.max(range * 0.05, 1);
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData, selectedBenchmarks, benchmarkKeyMap]);

  const tradeMarkers = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const p of chartData) {
      if (p.rawDate && p.portfolioIndex !== null && p.portfolioIndex !== undefined) {
        lookup.set(p.rawDate, p.portfolioIndex);
      }
    }
    type Marker = { key: string; x: string; y: number; side: 'buy' | 'sell' };
    const markers: Marker[] = [];
    for (const t of allTrades) {
      const rawDate = t.created_at.slice(0, 10);
      const y = lookup.get(rawDate);
      const pointForX = chartData.find((p) => p.rawDate === rawDate);
      if (y === undefined || !pointForX) continue;
      markers.push({
        key: `entry:${t.id}`,
        x: pointForX.date,
        y,
        side: t.trade_type === 'buy' ? 'buy' : 'sell',
      });
    }
    for (const pc of partialCloses) {
      const rawDate = pc.created_at.slice(0, 10);
      const y = lookup.get(rawDate);
      const pointForX = chartData.find((p) => p.rawDate === rawDate);
      if (y === undefined || !pointForX) continue;
      const parent =
        allTrades.find((t) => t.id === pc.trade_id) ??
        closedTrades.find((t) => t.id === pc.trade_id);
      const side: 'buy' | 'sell' = parent?.trade_type === 'buy' ? 'sell' : 'buy';
      markers.push({
        key: `exit:${pc.id}`,
        x: pointForX.date,
        y,
        side,
      });
    }
    return markers;
  }, [chartData, allTrades, closedTrades, partialCloses]);

  /** Current / latest point for the header readout when not scrubbing. */
  const latestPoint = useMemo(() => {
    for (let i = chartData.length - 1; i >= 0; i--) {
      const p = chartData[i];
      if (p.portfolioIndex !== null && p.portfolioIndex !== undefined) return p;
    }
    return null;
  }, [chartData]);

  const readoutPoint = scrub ?? latestPoint;
  const readoutDelta =
    readoutPoint && readoutPoint.portfolioIndex !== null
      ? readoutPoint.portfolioIndex - 100
      : null;

  if (!hasTrades) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center px-4">
          <p className="text-body text-foreground">Henüz işlem bulunmuyor</p>
          <p className="text-label text-muted-foreground mt-1">
            İşlemler açıldıkça grafik burada güncellenir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Scrub readout — shows portfolio index + delta, lives above chart.
          On mobile this is the primary affordance for data inspection: you
          touch the chart and the numbers at the top update. */}
      {readoutPoint && (
        <div className="flex items-center justify-between gap-3 px-4 md:px-3 pb-2">
          <div className="min-w-0">
            <div className="text-caption text-muted-foreground">
              {scrub ? readoutPoint.date : 'Son durum'}
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="num-lg text-foreground">
                {readoutPoint.portfolioIndex?.toFixed(1) ?? '—'}
              </span>
              {readoutDelta !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-label font-mono font-semibold',
                    readoutDelta >= 0 ? 'text-profit' : 'text-loss'
                  )}
                >
                  {readoutDelta >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {readoutDelta >= 0 ? '+' : ''}
                  {readoutDelta.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {missingSymbols.length > 0 && (
        <div className="flex items-center gap-2 text-caption text-muted-foreground mb-2 px-4 md:px-3">
          <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
          <span>
            {missingSymbols.join(', ')} için fiyat verisi alınamadı (tahmini)
          </span>
        </div>
      )}

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onMouseMove={(state) => {
              if (state?.activePayload?.[0]?.payload) {
                setScrub(state.activePayload[0].payload);
              }
            }}
            onMouseLeave={() => setScrub(null)}
          >
            <defs>
              {/* Subtle vertical gradient fill under the portfolio line */}
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.32}
                />
                <stop
                  offset="60%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.08}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
              {/* One gradient per selected benchmark — same treatment as the
                  portfolio fill (top-to-bottom fade to transparent) but
                  softer so multiple benchmarks don't drown out the portfolio.
              */}
              {selectedBenchmarks.map((benchmarkId) => {
                const benchmark = benchmarks.find((b) => b.id === benchmarkId);
                if (!benchmark) return null;
                return (
                  <linearGradient
                    key={`fill-${benchmarkId}`}
                    id={`benchmark-${benchmarkId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={benchmark.color}
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="60%"
                      stopColor={benchmark.color}
                      stopOpacity={0.04}
                    />
                    <stop
                      offset="100%"
                      stopColor={benchmark.color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="hsl(var(--border-subtle))"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
              }}
              minTickGap={28}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              domain={yDomain as [number, number]}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontWeight: 500,
              }}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: 'hsl(var(--primary))',
                strokeWidth: 1,
                strokeDasharray: '2 4',
              }}
            />
            <ReferenceLine
              y={100}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              strokeOpacity={0.35}
            />
            {/* Benchmarks render BEFORE the portfolio so the portfolio area
                paints on top. Each benchmark uses a solid stroke + its own
                soft color-matched gradient fill. */}
            {selectedBenchmarks.map((benchmarkId) => {
              const benchmark = benchmarks.find((b) => b.id === benchmarkId);
              if (!benchmark) return null;
              return (
                <Area
                  key={benchmarkId}
                  type="monotone"
                  dataKey={benchmarkKeyMap[benchmarkId]}
                  name={benchmark.name}
                  stroke={benchmark.color}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={`url(#benchmark-${benchmarkId})`}
                  fillOpacity={1}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: benchmark.color,
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              );
            })}
            <Area
              type="monotone"
              dataKey="portfolioIndex"
              name="Portföy"
              stroke="hsl(var(--primary))"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#portfolioFill)"
              fillOpacity={1}
              dot={false}
              activeDot={{
                r: 5,
                fill: 'hsl(var(--primary))',
                stroke: 'hsl(var(--background))',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
            {tradeMarkers.map((m) => (
              <ReferenceDot
                key={m.key}
                x={m.x}
                y={m.y}
                r={3}
                fill={
                  m.side === 'buy'
                    ? 'hsl(var(--profit))'
                    : 'hsl(var(--loss))'
                }
                stroke="hsl(var(--background))"
                strokeWidth={1.5}
                isFront
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
