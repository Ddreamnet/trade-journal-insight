import { useState, useMemo } from 'react';
import { TrendingUp, Trophy, Target, BarChart3 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { WinRateChart } from '@/components/reports/WinRateChart';
import { TimeRangeSelector } from '@/components/reports/TimeRangeSelector';
import { BenchmarkSelector } from '@/components/reports/BenchmarkSelector';
import { TimeRange, BENCHMARKS, Trade } from '@/types/trade';
import { useTrades } from '@/hooks/useTrades';
import { subDays, subMonths, subYears, parseISO, isAfter } from 'date-fns';

// Filter trades by time range
function filterTradesByTimeRange(trades: Trade[], timeRange: TimeRange): Trade[] {
  const now = new Date();
  let cutoffDate: Date;

  switch (timeRange) {
    case '1w':
      cutoffDate = subDays(now, 7);
      break;
    case '1m':
      cutoffDate = subMonths(now, 1);
      break;
    case '3m':
      cutoffDate = subMonths(now, 3);
      break;
    case '6m':
      cutoffDate = subMonths(now, 6);
      break;
    case '1y':
      cutoffDate = subYears(now, 1);
      break;
    default:
      cutoffDate = subMonths(now, 1);
  }

  return trades.filter((trade) => {
    const closedAt = trade.closed_at ? parseISO(trade.closed_at) : null;
    return closedAt && isAfter(closedAt, cutoffDate);
  });
}

export default function Reports() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1m');
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  
  const { closedTrades, isLoading } = useTrades();

  const toggleBenchmark = (benchmarkId: string) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(benchmarkId)
        ? prev.filter((id) => id !== benchmarkId)
        : [...prev, benchmarkId]
    );
  };

  // Filter closed trades by selected time range
  const filteredTrades = useMemo(() => {
    return filterTradesByTimeRange(closedTrades, selectedTimeRange);
  }, [closedTrades, selectedTimeRange]);

  // Calculate stats from filtered data
  const stats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const successfulTrades = filteredTrades.filter((t) => t.is_successful).length;
    const winRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;
    
    const rrValues = filteredTrades
      .filter((t) => t.rr_ratio !== null)
      .map((t) => t.rr_ratio as number);
    const avgRR = rrValues.length > 0 
      ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length 
      : 0;

    // Calculate best streak
    let bestStreak = 0;
    let currentStreak = 0;
    for (const trade of filteredTrades) {
      if (trade.is_successful) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return {
      totalTrades,
      winRate: winRate.toFixed(1),
      avgRR: avgRR.toFixed(1),
      bestStreak,
    };
  }, [filteredTrades]);

  return (
    <MainLayout>
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
            {isLoading ? '-' : stats.totalTrades}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-profit" />
            <span className="text-xs text-muted-foreground">Win Rate</span>
          </div>
          <div className="text-2xl font-bold text-profit font-mono">
            {isLoading ? '-' : `%${stats.winRate}`}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Ort. RR</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {isLoading ? '-' : stats.avgRR}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-profit" />
            <span className="text-xs text-muted-foreground">En İyi Seri</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {isLoading ? '-' : stats.bestStreak}
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
          filteredTrades={filteredTrades}
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
          💡 Benchmark verileri Stooq'tan günlük olarak çekilmektedir. Tüm değerler
          100 bazından normalize edilmiştir.
        </p>
      </div>
    </MainLayout>
  );
}
