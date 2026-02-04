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
import { useEquityCurveData, ChartDataPoint } from '@/hooks/useEquityCurveData';

interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  allTrades: Trade[];
  closedTrades: Trade[];
  startingCapital: number;
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
  closedTrades,
  startingCapital,
}: EquityCurveChartProps) {
  const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null);

  // Use shared hook for all data calculations
  const { chartData, t0 } = useEquityCurveData(
    timeRange,
    selectedBenchmarks,
    closedTrades,
    startingCapital
  );

  // Filter closed trades with position_amount for empty state check
  const closedTradesWithPositionAmount = useMemo(
    () => closedTrades.filter((t) => t.position_amount && t.exit_price && t.closed_at),
    [closedTrades]
  );

  // Benchmark key map
  const benchmarkKeyMap: Record<string, keyof ChartDataPoint> = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
  };

  // Get last non-null values for line labels
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
          {/* Portfolio curve with end label */}
          <Line
            type="monotone"
            dataKey="portfolioIndex"
            name="Portföy"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
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
          {/* Benchmark lines with end labels */}
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
  );
}
