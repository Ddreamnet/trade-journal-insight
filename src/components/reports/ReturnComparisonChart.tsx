import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList } from
'recharts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TimeRange, BenchmarkData, Trade, TIME_RANGES } from '@/types/trade';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEquityCurveData, ChartDataPoint, PartialCloseRecord } from '@/hooks/useEquityCurveData';
import { cn } from '@/lib/utils';
import { TimeRangeSelector } from '@/components/reports/TimeRangeSelector';


interface ReturnComparisonChartProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  closedTrades: Trade[];
  startingCapital: number;
  partialCloses: PartialCloseRecord[];
  portfolioSelected: boolean;
  children?: React.ReactNode;
}

interface ReturnDataPoint {
  id: string;
  name: string;
  value: number;
  color: string;
  startValue: number;
  endValue: number;
}

// Custom tooltip for bar chart
function BarTooltip({
  active,
  payload





}: {active?: boolean;payload?: Array<{payload: ReturnDataPoint;}>;}) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-sm">
      <div className="font-medium" style={{ color: data.color }}>
        {data.name}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
        <span className="text-muted-foreground">Başlangıç:</span>
        <span className="font-mono">{data.startValue.toFixed(1)}</span>
        <span className="text-muted-foreground">Bitiş:</span>
        <span className="font-mono">{data.endValue.toFixed(1)}</span>
        <span className="text-muted-foreground">Getiri:</span>
        <span
          className={cn(
            'font-mono font-semibold',
            data.value >= 0 ? 'text-profit' : 'text-loss'
          )}>

          {data.value >= 0 ? '+' : ''}
          {data.value.toFixed(2)}%
        </span>
      </div>
    </div>);

}

// Custom label for bar values
function BarValueLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number;
}) {
  const { x, y, width, height, value } = props;

  if (
  value === undefined ||
  typeof x !== 'number' ||
  typeof y !== 'number' ||
  typeof width !== 'number')
  {
    return null;
  }

  const isPositive = value >= 0;
  const labelX = x + width / 2;
  const labelY = isPositive ? y - 6 : y + (typeof height === 'number' ? height : 0) + 14;

  return (
    <text
      x={labelX}
      y={labelY}
      fill={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
      fontSize={11}
      fontFamily="JetBrains Mono, monospace"
      fontWeight={600}
      dominantBaseline="middle"
      textAnchor="middle">

      {isPositive ? '+' : ''}{value.toFixed(1)}%
    </text>);

}

// Calculate returns from chartData
function calculateReturns(
chartData: ChartDataPoint[],
selectedBenchmarks: string[],
benchmarks: BenchmarkData[],
portfolioSelected: boolean)
: ReturnDataPoint[] {
  const result: ReturnDataPoint[] = [];

  const findFirstLast = (
  data: ChartDataPoint[],
  accessor: (point: ChartDataPoint) => number | null | undefined)
  : {first: number | null;last: number | null;} => {
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

  // Portfolio — only if selected
  if (portfolioSelected) {
    const portfolioValues = findFirstLast(chartData, (p) => p.portfolioIndex);
    if (portfolioValues.first !== null && portfolioValues.last !== null) {
      const returnPct = (portfolioValues.last / portfolioValues.first - 1) * 100;
      result.push({
        id: 'portfolio',
        name: 'Portföy',
        value: returnPct,
        color: 'hsl(var(--primary))',
        startValue: portfolioValues.first,
        endValue: portfolioValues.last
      });
    }
  }

  // Benchmarks
  selectedBenchmarks.forEach((benchmarkId) => {
    const benchmark = benchmarks.find((b) => b.id === benchmarkId);
    if (!benchmark) return;

    const accessor = (point: ChartDataPoint): number | null | undefined => {
      switch (benchmarkId) {
        case 'gold':return point.gold;
        case 'usd':return point.usd;
        case 'eur':return point.eur;
        case 'bist100':return point.bist100;
        case 'nasdaq100':return point.nasdaq100;
        case 'inflation_tr':return point.inflation_tr;
        default:return null;
      }
    };

    const values = findFirstLast(chartData, accessor);
    if (values.first !== null && values.last !== null) {
      const returnPct = (values.last / values.first - 1) * 100;
      result.push({
        id: benchmarkId,
        name: benchmark.name,
        value: returnPct,
        color: benchmark.color,
        startValue: values.first,
        endValue: values.last
      });
    }
  });

  return result;
}

export function ReturnComparisonChart({
  timeRange,
  onTimeRangeChange,
  selectedBenchmarks,
  benchmarks,
  closedTrades,
  startingCapital,
  partialCloses,
  portfolioSelected,
  children
}: ReturnComparisonChartProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);

  const { chartData, t0 } = useEquityCurveData(
    timeRange,
    selectedBenchmarks,
    closedTrades,
    startingCapital,
    partialCloses
  );

  const returnData = useMemo(() => {
    return calculateReturns(chartData, selectedBenchmarks, benchmarks, portfolioSelected);
  }, [chartData, selectedBenchmarks, benchmarks, portfolioSelected]);

  const timeRangeLabel = TIME_RANGES.find((tr) => tr.id === timeRange)?.label || timeRange;

  if (!t0) {
    return null;
  }

  // Show message if no items selected
  if (returnData.length < 1) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <h3 className="text-sm font-medium text-foreground mb-2">% Sütun Grafiği</h3>
        <div className="mt-3 mb-2">
          <TimeRangeSelector selectedRange={timeRange} onSelect={onTimeRangeChange} />
        </div>
        {children}
      </div>);
  }

  const hasNoData = returnData.every((d) => d.startValue === d.endValue);
  if (hasNoData) {
    return (
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <h3 className="text-sm font-medium text-foreground mb-2">% Sütun Grafiği</h3>
        <div className="mt-3 mb-2">
          <TimeRangeSelector selectedRange={timeRange} onSelect={onTimeRangeChange} />
        </div>
        <p className="text-sm text-muted-foreground">
          Bu aralık için yeterli veri bulunamadı.
        </p>
        {children}
      </div>);
  }

  const chartHeight = isMobile ? 180 : 220;
  const needsScroll = returnData.length > 5;

  return (
    <div className="rounded-xl bg-card border border-border p-4 mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer">
            <h3 className="text-sm font-medium text-foreground">
              % Sütun Grafiği
            </h3>
            {isOpen ?
            <ChevronUp className="h-4 w-4 text-muted-foreground" /> :

            <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </div>
        </CollapsibleTrigger>

        {/* Time Range Selector — always visible */}
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <TimeRangeSelector selectedRange={timeRange} onSelect={onTimeRangeChange} />
        </div>

        {/* Collapsed view: Show chips */}
        {!isOpen &&
        <div className="flex flex-wrap gap-2 mt-3">
            {returnData.map((item) =>
          <div
            key={item.id}
            className="px-2 py-1 rounded-md text-xs font-mono font-semibold border"
            style={{
              backgroundColor: `${item.color}15`,
              borderColor: item.color
            }}>

                <span className="text-foreground">{item.name}</span>{' '}
                <span className={item.value >= 0 ? 'text-profit' : 'text-loss'}>
                  {item.value >= 0 ? '+' : ''}
                  {item.value.toFixed(1)}%
                </span>
              </div>
          )}
          </div>
        }

        <CollapsibleContent>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-3">
              Seçili aralık: {timeRangeLabel} — Toplam getiri %
            </p>

            <div className={cn(needsScroll && 'overflow-x-auto')}>
              <div
                style={{
                  minWidth: needsScroll ? returnData.length * 80 : 'auto'
                }}>

                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    data={returnData}
                    margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>

                    <XAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false} />

                    <YAxis
                      type="number"
                      domain={['auto', 'auto']}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(value: number) => `${value}%`} />

                    <Tooltip content={<BarTooltip />} cursor={false} />
                    <ReferenceLine
                      y={0}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="3 3" />

                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                      {returnData.map((entry) =>
                      <Cell key={entry.id} fill={entry.color} />
                      )}
                      <LabelList
                        dataKey="value"
                        content={(props: Record<string, unknown>) =>
                        <BarValueLabel
                          x={props.x as number | string | undefined}
                          y={props.y as number | string | undefined}
                          width={props.width as number | string | undefined}
                          height={props.height as number | string | undefined}
                          value={props.value as number | undefined} />

                        } />

                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {children}
    </div>);

}