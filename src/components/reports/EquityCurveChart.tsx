import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { TimeRange, BenchmarkData, Trade } from '@/types/trade';
import { useEquityCurveData, ChartDataPoint, PartialCloseRecord } from '@/hooks/useEquityCurveData';
import { useStockPriceSeries } from '@/hooks/useStockPriceSeries';
import { getTimeRangeDates } from '@/hooks/useEquityCurveData';
import { AlertTriangle } from 'lucide-react';

interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  allTrades: Trade[];
  closedTrades: Trade[];
  startingCapital: number;
  partialCloses: PartialCloseRecord[];
}

// Custom Label Component for line end values
function LineEndLabel({
  viewBox,
  value,
  color,
}: {
  viewBox?: { x?: number; y?: number };
  value: number | null;
  color: string;
}) {
  if (value === null || !viewBox?.x || !viewBox?.y) return null;

  return (
    <text
      x={(viewBox.x || 0) + 4}
      y={viewBox.y || 0}
      fill={color}
      fontSize={10}
      fontFamily="JetBrains Mono, monospace"
      fontWeight={600}
      dominantBaseline="middle"
    >
      {value.toFixed(0)}
    </text>
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

  if (portfolioValue === null || portfolioValue === undefined) return null;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <div className="font-medium mb-2 text-foreground">{label}</div>

      <div className="flex justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Portföy:</span>
        <span className="font-mono font-semibold text-primary">
          {portfolioValue.toFixed(1)} ({portfolioValue >= 100 ? '+' : ''}%{(portfolioValue - 100).toFixed(1)})
        </span>
      </div>

      {payload.length > 1 && <hr className="my-2 border-border" />}

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
          const pctChange = value - 100;
          const pctText = pctChange >= 0 ? `+%${pctChange.toFixed(1)}` : `-%${Math.abs(pctChange).toFixed(1)}`;

          return (
            <div key={p.dataKey} className="text-sm mb-1">
              <div className="flex justify-between gap-4">
                <span style={{ color: p.color }}>{p.name}:</span>
                <span className="font-mono">
                  {isInflation
                    ? `100 → ${value.toFixed(0)} TL`
                    : `${value.toFixed(1)} (${pctText})`}
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
  partialCloses,
}: EquityCurveChartProps) {
  const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null);

  // Calculate date window for stock price fetching
  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    [timeRange]
  );

  // Fetch stock price series for symbols with open positions in the view window
  const { priceMap: stockPriceMap, missingSymbols, isLoading: priceLoading } = useStockPriceSeries(
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

  const hasTrades = useMemo(
    () => allTrades.length > 0 || closedTrades.some((t) => t.closed_at),
    [allTrades, closedTrades]
  );

  const benchmarkKeyMap: Record<string, keyof ChartDataPoint> = {
    gold: 'gold',
    silver: 'silver',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
    btcusdt: 'btcusdt',
  };

  // Dynamic Y-axis domain calculation
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
    const padding = Math.max(range * 0.05, 1); // en az 1 birim padding
    return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
  }, [chartData, selectedBenchmarks]);

  const lastValues = useMemo(() => {
    const result: Record<string, number | null> = { portfolioIndex: null };
    selectedBenchmarks.forEach((id) => {
      result[id] = null;
    });

    for (let i = chartData.length - 1; i >= 0; i--) {
      const point = chartData[i];
      if (result.portfolioIndex === null && point.portfolioIndex !== null) {
        result.portfolioIndex = point.portfolioIndex;
      }
      selectedBenchmarks.forEach((id) => {
        if (result[id] === null) {
          const val = point[id as keyof ChartDataPoint] as number | null | undefined;
          if (val !== null && val !== undefined) {
            result[id] = val;
          }
        }
      });
    }
    return result;
  }, [chartData, selectedBenchmarks]);

  if (!hasTrades) {
    return (
      <div className="w-full h-[300px] sm:h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-2">
            Henüz işlem bulunmuyor
          </p>
          <p className="text-xs text-muted-foreground">
            İşlemler açıldığında grafik burada görünecek
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {missingSymbols.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 px-1">
          <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
          <span>{missingSymbols.join(', ')} için fiyat verisi alınamadı (tahmini)</span>
        </div>
      )}
      <div className="w-full h-[300px] sm:h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 45, left: -10, bottom: 5 }}
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
            domain={yDomain as [number, number]}
          />
          <Tooltip
            content={<CustomTooltip benchmarks={benchmarks} />}
          />
          <ReferenceLine
            y={100}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          {/* Portfolio curve — ~50% thinner */}
          <Line
            type="monotone"
            dataKey="portfolioIndex"
            name="Portföy"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
          >
            <LabelList
              dataKey="portfolioIndex"
              position="right"
              content={({ index, ...props }) =>
                index === chartData.length - 1 ? (
                  <LineEndLabel
                    viewBox={props as { x?: number; y?: number }}
                    value={lastValues.portfolioIndex}
                    color="hsl(var(--primary))"
                  />
                ) : null
              }
            />
          </Line>
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
              >
                <LabelList
                  dataKey={benchmarkKeyMap[benchmarkId]}
                  position="right"
                  content={({ index, ...props }) =>
                    index === chartData.length - 1 ? (
                      <LineEndLabel
                        viewBox={props as { x?: number; y?: number }}
                        value={lastValues[benchmarkId]}
                        color={benchmark.color}
                      />
                    ) : null
                  }
                />
              </Line>
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
