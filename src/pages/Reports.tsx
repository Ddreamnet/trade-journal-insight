import { useState, useMemo } from 'react';
import { TrendingUp, Trophy, BarChart3, Wallet } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { EquityCurveChart } from '@/components/reports/EquityCurveChart';
import { TimeRangeSelector } from '@/components/reports/TimeRangeSelector';
import { BenchmarkSelector } from '@/components/reports/BenchmarkSelector';
import { TimeRange, BENCHMARKS, Trade } from '@/types/trade';
import { MarketAsset } from '@/types/market';
import { useTrades } from '@/hooks/useTrades';
import { subMonths, startOfYear, parseISO, isAfter } from 'date-fns';

// Calculate PnL for a trade
function calculateTradePnL(trade: Trade): number {
  if (!trade.exit_price || !trade.position_amount) return 0;

  const entry = trade.entry_price;
  const exit = trade.exit_price;
  const positionAmount = trade.position_amount;

  let returnPercent: number;

  if (trade.trade_type === 'buy') {
    returnPercent = (exit - entry) / entry;
  } else {
    returnPercent = (entry - exit) / entry;
  }

  return positionAmount * returnPercent;
}

// Filter trades by time range
function filterTradesByTimeRange(trades: Trade[], timeRange: TimeRange): Trade[] {
  const now = new Date();
  let cutoffDate: Date;

  switch (timeRange) {
    case '1m':
      cutoffDate = subMonths(now, 1);
      break;
    case '3m':
      cutoffDate = subMonths(now, 3);
      break;
    case '1y':
      cutoffDate = subMonths(now, 12);
      break;
    case 'ytd':
      cutoffDate = startOfYear(now);
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
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<MarketAsset[]>([]);

  const { closedTrades, isLoading } = useTrades();

  const toggleBenchmark = (benchmarkId: string) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(benchmarkId as MarketAsset)
        ? prev.filter((id) => id !== benchmarkId)
        : [...prev, benchmarkId as MarketAsset]
    );
  };

  // Filter closed trades by selected time range
  const filteredTrades = useMemo(() => {
    return filterTradesByTimeRange(closedTrades, selectedTimeRange);
  }, [closedTrades, selectedTimeRange]);

  // Calculate stats from filtered data
  const stats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const karAlTrades = filteredTrades.filter((t) => t.closing_type === 'kar_al').length;
    const winRate = totalTrades > 0 ? (karAlTrades / totalTrades) * 100 : 0;

    const rrValues = filteredTrades
      .filter((t) => t.rr_ratio !== null)
      .map((t) => t.rr_ratio as number);
    const avgRR =
      rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;

    // Calculate total PnL
    const totalPnL = filteredTrades.reduce((sum, trade) => {
      return sum + calculateTradePnL(trade);
    }, 0);

    // Calculate best streak (kar_al streak)
    let bestStreak = 0;
    let currentStreak = 0;
    for (const trade of filteredTrades) {
      if (trade.closing_type === 'kar_al') {
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
      totalPnL,
    };
  }, [filteredTrades]);

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Raporlarım</h1>
        <p className="text-muted-foreground">İşlem performansınızı analiz edin</p>
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
            <span className="text-xs text-muted-foreground">Kâr Al %</span>
          </div>
          <div className="text-2xl font-bold text-profit font-mono">
            {isLoading ? '-' : `%${stats.winRate}`}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Toplam K/Z</span>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'
            }`}
          >
            {isLoading
              ? '-'
              : `${stats.totalPnL >= 0 ? '+' : ''}₺${stats.totalPnL.toFixed(0)}`}
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
          <h2 className="text-lg font-semibold text-foreground">Equity Curve</h2>
          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onSelect={setSelectedTimeRange}
          />
        </div>

        <EquityCurveChart
          timeRange={selectedTimeRange}
          selectedBenchmarks={selectedBenchmarks}
          filteredTrades={filteredTrades}
          initialCapital={1000}
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
          💡 Benchmark'lar, işlemlerinizin aynı tutarlarla ve aynı tarihlerde ilgili enstrümana
          yatırılmış olsaydı ne olacağını simüle eder. Portföyünüze göre yüzdesel fark gösterilir.
        </p>
      </div>
    </MainLayout>
  );
}
