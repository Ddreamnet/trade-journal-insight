import { useState, useCallback } from 'react';
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
import { TimeRange, BenchmarkData, Trade, EquityChartPoint, BENCHMARKS } from '@/types/trade';
import { MarketAsset } from '@/types/market';
import { useEquityCurve } from '@/hooks/useEquityCurve';
import { EquityPanel } from './EquityPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: MarketAsset[];
  filteredTrades: Trade[];
  initialCapital?: number;
}

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  label,
  selectedBenchmarks,
  initialCapital,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  selectedBenchmarks: MarketAsset[];
  initialCapital: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as EquityChartPoint;
  if (!data) return null;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>

      {/* Portfolio */}
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Portföy</span>
        </div>
        <div className="text-sm font-mono">
          <span className="text-foreground">{data.portfolioEquity.toLocaleString('tr-TR')} ₺</span>
          <span
            className={`ml-2 ${
              data.portfolioReturnPct >= 0 ? 'text-profit' : 'text-loss'
            }`}
          >
            ({data.portfolioReturnPct >= 0 ? '+' : ''}
            {data.portfolioReturnPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Benchmarks */}
      {selectedBenchmarks.map((assetId) => {
        const benchmark = BENCHMARKS.find((b) => b.id === assetId);
        if (!benchmark) return null;

        const relativeDiff = (data as any)[assetId];
        const benchValue = (data as any)[`${assetId}Value`];

        // Special handling for inflation
        if (assetId === 'inflation_tr') {
          const inflationPP = data.inflationPurchasingPower;
          if (inflationPP) {
            return (
              <div key={assetId} className="flex items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: benchmark.color }}
                  />
                  <span className="text-sm text-muted-foreground">{benchmark.name}</span>
                </div>
                <span className="text-sm font-mono text-foreground">
                  {initialCapital.toLocaleString('tr-TR')} → {inflationPP.toLocaleString('tr-TR')} ₺
                </span>
              </div>
            );
          }
          return null;
        }

        if (relativeDiff === undefined) return null;

        return (
          <div key={assetId} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: benchmark.color }}
              />
              <span className="text-sm text-muted-foreground">{benchmark.name}</span>
            </div>
            <div className="text-sm font-mono">
              {benchValue && (
                <span className="text-foreground mr-2">
                  {benchValue.toLocaleString('tr-TR')} ₺
                </span>
              )}
              <span
                className={
                  relativeDiff > 0
                    ? 'text-loss'
                    : relativeDiff < 0
                    ? 'text-profit'
                    : 'text-muted-foreground'
                }
              >
                ({relativeDiff > 0 ? '+' : ''}
                {relativeDiff.toFixed(1)}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EquityCurveChart({
  timeRange,
  selectedBenchmarks,
  filteredTrades,
  initialCapital = 1000,
}: EquityCurveChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<EquityChartPoint | null>(null);

  const { chartData, summary, isLoading, hasData, missingPositionAmounts } = useEquityCurve(
    filteredTrades,
    timeRange,
    selectedBenchmarks,
    initialCapital
  );

  const handleMouseMove = useCallback((e: any) => {
    if (e?.activePayload?.[0]?.payload) {
      setHoveredPoint(e.activePayload[0].payload);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  // Benchmark key mapping
  const benchmarkKeyMap: Record<string, string> = {
    gold: 'gold',
    usd: 'usd',
    eur: 'eur',
    bist100: 'bist100',
    nasdaq100: 'nasdaq100',
    inflation_tr: 'inflation_tr',
  };

  return (
    <div className="w-full">
      {/* Warning for missing position amounts */}
      {missingPositionAmounts > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
          <p className="text-sm text-warning">
            {missingPositionAmounts} kapatılmış işlemde işlem tutarı eksik. Bu işlemler grafiğe dahil
            edilmedi.
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Chart */}
        <div className="flex-1 h-[300px] sm:h-[350px]">
          {isLoading && selectedBenchmarks.length > 0 ? (
            <div className="w-full h-full flex items-center justify-center">
              <Skeleton className="w-full h-full" />
            </div>
          ) : !hasData ? (
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
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
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
                  tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}%`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={
                    <CustomTooltip
                      selectedBenchmarks={selectedBenchmarks}
                      initialCapital={initialCapital}
                    />
                  }
                />
                {/* Reference line at 0% (portfolio baseline) */}
                <ReferenceLine
                  y={0}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{
                    value: 'Portföy',
                    position: 'right',
                    fill: 'hsl(var(--primary))',
                    fontSize: 11,
                  }}
                />
                {/* Benchmark lines (relative diff from portfolio) */}
                {selectedBenchmarks.map((benchmarkId) => {
                  const benchmark = BENCHMARKS.find((b) => b.id === benchmarkId);
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
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Side Panel (hidden on mobile, shown below chart) */}
        <div className="lg:w-64 flex-shrink-0">
          <EquityPanel
            summary={summary}
            selectedBenchmarks={selectedBenchmarks}
            benchmarks={BENCHMARKS}
            hoveredPoint={hoveredPoint}
            initialCapital={initialCapital}
          />
        </div>
      </div>
    </div>
  );
}
