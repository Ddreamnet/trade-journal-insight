import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Trophy, BarChart3, Wallet, Settings } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { EquityCurveChart } from '@/components/reports/EquityCurveChart';
import { TimeRangeSelector } from '@/components/reports/TimeRangeSelector';
import { BenchmarkSelector } from '@/components/reports/BenchmarkSelector';
import { TimeRange, BENCHMARKS, Trade } from '@/types/trade';
import { useTrades } from '@/hooks/useTrades';
import { subDays, subMonths, subYears, parseISO, isAfter } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
    case '3y':
      cutoffDate = subYears(now, 3);
      break;
    default:
      cutoffDate = subMonths(now, 1);
  }

  return trades.filter((trade) => {
    const closedAt = trade.closed_at ? parseISO(trade.closed_at) : null;
    return closedAt && isAfter(closedAt, cutoffDate);
  });
}

const STARTING_CAPITAL_KEY = 'reports-starting-capital';

export default function Reports() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1m');
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [startingCapital, setStartingCapital] = useState<number>(() => {
    const saved = localStorage.getItem(STARTING_CAPITAL_KEY);
    return saved ? Number(saved) : 1000;
  });
  const [tempCapital, setTempCapital] = useState<string>(startingCapital.toString());
  
  // Track if user has manually saved starting capital (localStorage has value)
  const [hasUserSavedCapital, setHasUserSavedCapital] = useState<boolean>(() => {
    return localStorage.getItem(STARTING_CAPITAL_KEY) !== null;
  });
  
  const { trades, closedTrades, isLoading } = useTrades();

  // Auto-set starting capital from first trade's position_amount
  // ONLY if user hasn't manually saved a value (no localStorage entry)
  useEffect(() => {
    if (hasUserSavedCapital) return; // User explicitly saved, don't override
    if (trades.length === 0) return;
    
    const sortedTrades = [...trades].sort(
      (a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime()
    );
    const firstTrade = sortedTrades[0];
    if (firstTrade?.position_amount) {
      const newCapital = firstTrade.position_amount;
      setStartingCapital(newCapital);
      setTempCapital(newCapital.toString());
      // DO NOT save to localStorage - only display in UI
    }
  }, [trades, hasUserSavedCapital]);

  const handleCapitalSave = () => {
    const value = Math.max(100, Number(tempCapital) || 1000);
    setStartingCapital(value);
    setTempCapital(value.toString());
    setHasUserSavedCapital(true); // User explicitly saved
    localStorage.setItem(STARTING_CAPITAL_KEY, value.toString());
  };

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
    const karAlTrades = filteredTrades.filter((t) => t.closing_type === 'kar_al').length;
    const winRate = totalTrades > 0 ? (karAlTrades / totalTrades) * 100 : 0;
    
    const rrValues = filteredTrades
      .filter((t) => t.rr_ratio !== null)
      .map((t) => t.rr_ratio as number);
    const avgRR = rrValues.length > 0 
      ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length 
      : 0;

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
          <div className={`text-2xl font-bold font-mono ${stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {isLoading ? '-' : `${stats.totalPnL >= 0 ? '+' : ''}₺${stats.totalPnL.toFixed(0)}`}
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
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Equity Curve
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-3">
                  <div className="text-sm font-medium">Başlangıç Sermayesi</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={tempCapital}
                      onChange={(e) => setTempCapital(e.target.value)}
                      className="h-8 text-sm"
                      min={100}
                    />
                    <span className="text-sm text-muted-foreground">TL</span>
                  </div>
                  <Button size="sm" onClick={handleCapitalSave} className="w-full">
                    Kaydet
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Bu değer 100 bazlı endeks hesaplamasında kullanılır.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onSelect={setSelectedTimeRange}
          />
        </div>

        <EquityCurveChart
          timeRange={selectedTimeRange}
          selectedBenchmarks={selectedBenchmarks}
          benchmarks={BENCHMARKS}
          allTrades={trades}
          closedTrades={closedTrades}
          startingCapital={startingCapital}
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
          💡 Piyasa verileri Stooq ve TCMB EVDS'den çekilmektedir. Tüm değerler
          ilk işlem tarihinden itibaren 100 bazından normalize edilmiştir.
        </p>
      </div>
    </MainLayout>
  );
}
