import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { TimeRange, BenchmarkData, Trade } from '@/types/trade';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useEquityCurveData,
  ChartDataPoint,
  PartialCloseRecord,
  getTimeRangeDates,
} from '@/hooks/useEquityCurveData';
import { useStockPriceSeries } from '@/hooks/useStockPriceSeries';
import { cn } from '@/lib/utils';

interface ReturnComparisonChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  closedTrades: Trade[];
  allTrades: Trade[];
  startingCapital: number;
  partialCloses: PartialCloseRecord[];
  portfolioSelected: boolean;
  height?: number;
}

interface ReturnDataPoint {
  id: string;
  name: string;
  value: number;
  color: string;
  startValue: number;
  endValue: number;
}

/**
 * Return comparison — BARE bar chart. No card chrome; Reports wraps this
 * in ChartCard so the card layer is uniform with every other chart.
 *
 * Key mobile moves:
 *   - Body fills card width (no inner padding)
 *   - BarChart uses tight left/right margins (8/4)
 *   - YAxis width locked at 32px; tick labels in mono + caption size
 *   - Tooltip uses our surface tokens, not the default Recharts popover
 */
export function ReturnComparisonChart({
  timeRange,
  selectedBenchmarks,
  benchmarks,
  closedTrades,
  allTrades,
  startingCapital,
  partialCloses,
  portfolioSelected,
  height,
}: ReturnComparisonChartProps) {
  const isMobile = useIsMobile();

  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    [timeRange]
  );
  const { priceMap: stockPriceMap, missingSymbols } = useStockPriceSeries(
    allTrades,
    startDate,
    endDate
  );

  const { chartData, t0 } = useEquityCurveData(
    timeRange,
    selectedBenchmarks,
    closedTrades,
    startingCapital,
    partialCloses,
    allTrades,
    stockPriceMap,
    missingSymbols
  );

  const returnData = useMemo<ReturnDataPoint[]>(() => {
    const result: ReturnDataPoint[] = [];

    const findFirstLast = (
      data: ChartDataPoint[],
      accessor: (point: ChartDataPoint) => number | null | undefined
    ): { first: number | null; last: number | null } => {
      let first: number | null = null;
      let last: number | null = null;
      for (const point of data) {
        const val = accessor(point);
        if (val !== null && val !== undefined) {
          if (first === null) first = val;
          last = val;
        }
      }
      return { first, last };
    };

    if (portfolioSelected) {
      const v = findFirstLast(chartData, (p) => p.portfolioIndex);
      if (v.first !== null && v.last !== null) {
        result.push({
          id: 'portfolio',
          name: 'Portföy',
          value: (v.last / v.first - 1) * 100,
          color: 'hsl(var(--primary))',
          startValue: v.first,
          endValue: v.last,
        });
      }
    }

    selectedBenchmarks.forEach((benchmarkId) => {
      const benchmark = benchmarks.find((b) => b.id === benchmarkId);
      if (!benchmark) return;
      const accessor = (point: ChartDataPoint): number | null | undefined => {
        switch (benchmarkId) {
          case 'gold': return point.gold;
          case 'silver': return point.silver;
          case 'usd': return point.usd;
          case 'eur': return point.eur;
          case 'bist100': return point.bist100;
          case 'nasdaq100': return point.nasdaq100;
          case 'inflation_tr': return point.inflation_tr;
          case 'btcusdt': return point.btcusdt;
          default: return null;
        }
      };
      const v = findFirstLast(chartData, accessor);
      if (v.first !== null && v.last !== null) {
        result.push({
          id: benchmarkId,
          name: benchmark.name,
          value: (v.last / v.first - 1) * 100,
          color: benchmark.color,
          startValue: v.first,
          endValue: v.last,
        });
      }
    });

    return result;
  }, [chartData, selectedBenchmarks, benchmarks, portfolioSelected]);

  if (!t0) return null;

  const chartHeight = height ?? (isMobile ? 220 : 260);

  if (returnData.length < 1) {
    return (
      <div
        className="flex items-center justify-center px-4"
        style={{ height: chartHeight }}
      >
        <p className="text-label text-muted-foreground text-center">
          Karşılaştırmak için portföy veya bir benchmark seçin.
        </p>
      </div>
    );
  }

  const hasNoData = returnData.every((d) => d.startValue === d.endValue);
  if (hasNoData) {
    return (
      <div
        className="flex items-center justify-center px-4"
        style={{ height: chartHeight }}
      >
        <p className="text-label text-muted-foreground text-center">
          Bu aralık için yeterli veri bulunamadı.
        </p>
      </div>
    );
  }

  const needsScroll = returnData.length > 5;

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <div
        className={cn('h-full', needsScroll && 'overflow-x-auto')}
      >
        <div
          className="h-full"
          style={{ minWidth: needsScroll ? returnData.length * 80 : 'auto' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={returnData}
              margin={{ top: 28, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              {/* Per-bar gradient defs — each bar fades from full color at top
                  to a slightly dimmer tone at the bottom. More premium than
                  flat fills while staying quiet. */}
              <defs>
                {returnData.map((entry) => (
                  <linearGradient
                    key={entry.id}
                    id={`bar-${entry.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={entry.color}
                      stopOpacity={1}
                    />
                    <stop
                      offset="100%"
                      stopColor={entry.color}
                      stopOpacity={0.6}
                    />
                  </linearGradient>
                ))}
              </defs>
              <XAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                }}
                interval={0}
              />
              <YAxis
                type="number"
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                width={36}
                tick={{
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontWeight: 500,
                }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                content={<BarTooltip />}
                cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.15 }}
              />
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              >
                {returnData.map((entry) => (
                  <Cell key={entry.id} fill={`url(#bar-${entry.id})`} />
                ))}
                <LabelList
                  dataKey="value"
                  content={(props: Record<string, unknown>) => (
                    <BarValueLabel
                      x={props.x as number | undefined}
                      y={props.y as number | undefined}
                      width={props.width as number | undefined}
                      height={props.height as number | undefined}
                      value={props.value as number | undefined}
                    />
                  )}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ReturnDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isUp = d.value >= 0;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/95 backdrop-blur-sm px-3 py-2.5 shadow-lg min-w-[160px]">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: d.color }}
        />
        <span className="text-label text-foreground">{d.name}</span>
      </div>
      <div
        className={cn(
          'num-lg',
          isUp ? 'text-profit' : 'text-loss'
        )}
      >
        {isUp ? '+' : ''}
        {d.value.toFixed(2)}%
      </div>
    </div>
  );
}

function BarValueLabel({
  x,
  y,
  width,
  height,
  value,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}) {
  if (
    value === undefined ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number'
  ) {
    return null;
  }
  const isPositive = value >= 0;
  const labelX = x + width / 2;
  const labelY = isPositive ? y - 8 : y + (typeof height === 'number' ? height : 0) + 14;
  return (
    <text
      x={labelX}
      y={labelY}
      fill={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
      fontSize={11}
      fontFamily="JetBrains Mono, ui-monospace, monospace"
      fontWeight={600}
      dominantBaseline="middle"
      textAnchor="middle"
    >
      {isPositive ? '+' : ''}
      {value.toFixed(1)}%
    </text>
  );
}
