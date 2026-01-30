import { EquitySummary, BenchmarkData, EquityChartPoint } from '@/types/trade';
import { MarketAsset } from '@/types/market';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EquityPanelProps {
  summary: EquitySummary;
  selectedBenchmarks: MarketAsset[];
  benchmarks: BenchmarkData[];
  hoveredPoint?: EquityChartPoint | null;
  initialCapital: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function DiffIndicator({ value }: { value: number }) {
  if (value > 0.5) {
    return <TrendingUp className="w-4 h-4 text-loss" />;
  } else if (value < -0.5) {
    return <TrendingDown className="w-4 h-4 text-profit" />;
  }
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export function EquityPanel({
  summary,
  selectedBenchmarks,
  benchmarks,
  hoveredPoint,
  initialCapital,
}: EquityPanelProps) {
  // Use hovered point data if available, otherwise use summary
  const displayValue = hoveredPoint?.portfolioEquity ?? summary.currentPortfolioValue;
  const displayReturnPct = hoveredPoint?.portfolioReturnPct ?? summary.portfolioReturnPct;

  // Get inflation purchasing power
  const inflationFrom = summary.inflationPurchasingPower.from;
  const inflationTo = hoveredPoint?.inflationPurchasingPower ?? summary.inflationPurchasingPower.to;

  return (
    <div className="space-y-4">
      {/* Portfolio Section */}
      <div className="p-4 rounded-xl bg-secondary/50 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm font-medium text-foreground">Portföy</span>
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold font-mono text-foreground">
            {formatCurrency(displayValue)} ₺
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {formatCurrency(initialCapital)} ₺ → {formatCurrency(displayValue)} ₺
            </span>
            <span
              className={`text-sm font-mono font-semibold ${
                displayReturnPct >= 0 ? 'text-profit' : 'text-loss'
              }`}
            >
              ({formatPercent(displayReturnPct)})
            </span>
          </div>
        </div>
      </div>

      {/* Benchmarks Section */}
      {selectedBenchmarks.length > 0 && (
        <div className="space-y-2">
          {selectedBenchmarks.map((assetId) => {
            const benchmark = benchmarks.find((b) => b.id === assetId);
            if (!benchmark) return null;

            // Get relative diff
            const assetKey = assetId as keyof EquityChartPoint;
            const valueKey = `${assetId}Value` as keyof EquityChartPoint;
            
            const relativeDiff = hoveredPoint
              ? (hoveredPoint as any)[assetKey] ?? 0
              : summary.benchmarkDiffs[assetId] ?? 0;
            
            const benchValue = hoveredPoint
              ? (hoveredPoint as any)[valueKey] ?? initialCapital
              : summary.benchmarkValues[assetId] ?? initialCapital;

            // Special handling for inflation
            if (assetId === 'inflation_tr') {
              return (
                <div
                  key={assetId}
                  className="p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: benchmark.color }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {benchmark.name}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(inflationFrom)} ₺ → {formatCurrency(inflationTo)} ₺
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Aynı alım gücü için
                  </div>
                </div>
              );
            }

            return (
              <div
                key={assetId}
                className="p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: benchmark.color }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {benchmark.name}
                    </span>
                  </div>
                  <DiffIndicator value={relativeDiff} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-mono text-foreground">
                    {formatCurrency(benchValue)} ₺
                  </span>
                  <span
                    className={`text-sm font-mono font-semibold ${
                      relativeDiff > 0
                        ? 'text-loss'
                        : relativeDiff < 0
                        ? 'text-profit'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {relativeDiff > 0 ? '+' : ''}
                    {relativeDiff.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {relativeDiff > 0
                    ? 'Portföyden önde'
                    : relativeDiff < 0
                    ? 'Portföyden geride'
                    : 'Portföyle eşit'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {selectedBenchmarks.length === 0 && (
        <div className="p-4 rounded-lg border border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground">
            Kıyaslama için aşağıdan bir veya daha fazla enstrüman seçin
          </p>
        </div>
      )}
    </div>
  );
}
