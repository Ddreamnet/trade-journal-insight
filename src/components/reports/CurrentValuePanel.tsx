import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BenchmarkData } from '@/types/trade';
import { CurrentValueData } from '@/types/portfolio';
import { ASSET_LABELS } from '@/types/market';

interface CurrentValuePanelProps {
  data: CurrentValueData | null;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  isLoading?: boolean;
}

export function CurrentValuePanel({
  data,
  selectedBenchmarks,
  benchmarks,
  isLoading = false,
}: CurrentValuePanelProps) {
  const sortedBenchmarks = useMemo(() => {
    return selectedBenchmarks
      .map((id) => {
        const benchmark = benchmarks.find((b) => b.id === id);
        const diff = data?.benchmarkDiffs[id] ?? 0;
        return { id, benchmark, diff };
      })
      .filter((b) => b.benchmark)
      .sort((a, b) => b.diff - a.diff);
  }, [selectedBenchmarks, benchmarks, data]);

  if (isLoading) {
    return (
      <div className="w-full lg:w-64 p-4 rounded-xl bg-card border border-border animate-pulse">
        <div className="h-4 bg-secondary rounded w-24 mb-4" />
        <div className="h-8 bg-secondary rounded w-full mb-4" />
        <div className="space-y-2">
          <div className="h-6 bg-secondary rounded w-full" />
          <div className="h-6 bg-secondary rounded w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full lg:w-64 p-4 rounded-xl bg-card border border-border">
        <p className="text-sm text-muted-foreground text-center">
          Henüz portföy verisi yok
        </p>
        <p className="text-xs text-muted-foreground text-center mt-2">
          💡 "Nakit Ekle" ile başlayın
        </p>
      </div>
    );
  }

  const TrendIcon = data.portfolioReturnPct > 0 
    ? TrendingUp 
    : data.portfolioReturnPct < 0 
      ? TrendingDown 
      : Minus;

  return (
    <div className="w-full lg:w-64 p-4 rounded-xl bg-card border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{data.date}</span>
        <Wallet className="w-4 h-4 text-primary" />
      </div>

      {/* Unit Price */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">Birim Fiyat</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-foreground">
            ₺{data.unitPrice.toFixed(2)}
          </span>
          <span className={cn(
            'flex items-center gap-1 text-sm font-mono font-semibold',
            data.portfolioReturnPct > 0 ? 'text-profit' : 
            data.portfolioReturnPct < 0 ? 'text-loss' : 'text-muted-foreground'
          )}>
            <TrendIcon className="w-3 h-3" />
            {data.portfolioReturnPct > 0 ? '+' : ''}{data.portfolioReturnPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Benchmark Comparisons */}
      {sortedBenchmarks.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-muted-foreground">Karşılaştırma</p>
          {sortedBenchmarks.map(({ id, benchmark, diff }) => {
            const isInflation = id === 'inflation_tr';
            const label = benchmark?.name || ASSET_LABELS[id as keyof typeof ASSET_LABELS] || id;
            
            return (
              <div 
                key={id} 
                className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-secondary/50"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: benchmark?.color || '#888' }}
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </div>
                <span className={cn(
                  'text-sm font-mono font-semibold',
                  diff > 0 ? 'text-profit' : diff < 0 ? 'text-loss' : 'text-muted-foreground'
                )}>
                  {isInflation && data.inflationText ? (
                    <span className="text-xs">{data.inflationText}</span>
                  ) : (
                    <>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Inflation Special Display */}
      {data.inflationText && !selectedBenchmarks.includes('inflation_tr') && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Enflasyon Etkisi</p>
          <p className="text-sm font-mono text-foreground">{data.inflationText}</p>
        </div>
      )}

      {/* Legend */}
      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          <span className="text-profit">+</span> portföyün önünde, 
          <span className="text-loss"> -</span> portföyün gerisinde
        </p>
      </div>
    </div>
  );
}
