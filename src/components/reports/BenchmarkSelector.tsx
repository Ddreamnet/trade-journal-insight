import { BenchmarkData } from '@/types/trade';
import { cn } from '@/lib/utils';

interface BenchmarkSelectorProps {
  benchmarks: BenchmarkData[];
  selectedBenchmarks: string[];
  onToggle: (benchmarkId: string) => void;
}

export function BenchmarkSelector({
  benchmarks,
  selectedBenchmarks,
  onToggle,
}: BenchmarkSelectorProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Karşılaştır</h3>
      <div className="flex flex-wrap gap-2">
        {benchmarks.map((benchmark) => {
          const isSelected = selectedBenchmarks.includes(benchmark.id);
          return (
            <button
              key={benchmark.id}
              onClick={() => onToggle(benchmark.id)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                isSelected
                  ? 'border-transparent text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
              style={{
                backgroundColor: isSelected ? `${benchmark.color}20` : 'transparent',
                borderColor: isSelected ? benchmark.color : undefined,
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: benchmark.color }}
              />
              {benchmark.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
