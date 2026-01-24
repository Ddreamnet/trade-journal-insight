import { useState } from 'react';
import { TrendingUp, Trophy, Target, BarChart3 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { WinRateChart } from '@/components/reports/WinRateChart';
import { TimeRangeSelector } from '@/components/reports/TimeRangeSelector';
import { BenchmarkSelector } from '@/components/reports/BenchmarkSelector';
import { TimeRange, BENCHMARKS } from '@/types/trade';

interface ReportsProps {
  onLogout: () => void;
}

export default function Reports({ onLogout }: ReportsProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1m');
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);

  const toggleBenchmark = (benchmarkId: string) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(benchmarkId)
        ? prev.filter((id) => id !== benchmarkId)
        : [...prev, benchmarkId]
    );
  };

  // Mock stats (will be calculated from real data later)
  const stats = {
    totalTrades: 47,
    winRate: 63.8,
    avgRR: 2.4,
    bestStreak: 7,
  };

  return (
    <MainLayout onLogout={onLogout}>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Raporlarım</h1>
        <p className="text-muted-foreground">
          İşlem performansınızı analiz edin
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Toplam İşlem</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {stats.totalTrades}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-profit" />
            <span className="text-xs text-muted-foreground">Win Rate</span>
          </div>
          <div className="text-2xl font-bold text-profit font-mono">
            %{stats.winRate}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Ort. RR</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {stats.avgRR}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-profit" />
            <span className="text-xs text-muted-foreground">En İyi Seri</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {stats.bestStreak}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Performans Grafiği
          </h2>
          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onSelect={setSelectedTimeRange}
          />
        </div>

        <WinRateChart
          timeRange={selectedTimeRange}
          selectedBenchmarks={selectedBenchmarks}
          benchmarks={BENCHMARKS}
        />
      </div>

      {/* Benchmark Selector */}
      <div className="rounded-xl bg-card border border-border p-4">
        <BenchmarkSelector
          benchmarks={BENCHMARKS}
          selectedBenchmarks={selectedBenchmarks}
          onToggle={toggleBenchmark}
        />
        <p className="text-xs text-muted-foreground mt-3">
          💡 Karşılaştırma verisi sonradan API ile güncellenecektir. Şu an örnek
          veri gösterilmektedir.
        </p>
      </div>
    </MainLayout>
  );
}
