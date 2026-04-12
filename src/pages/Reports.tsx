import { useState, useMemo, useEffect } from 'react';
import { BarChart3, Trophy, Wallet, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { EquityCurveChart } from '@/components/reports/EquityCurveChart';
import { ReturnComparisonChart } from '@/components/reports/ReturnComparisonChart';
import { PortfolioValueChart } from '@/components/reports/PortfolioValueChart';
import { AssetsChart } from '@/components/reports/AssetsChart';
import { TimeRangeSelector } from '@/components/reports/TimeRangeSelector';
import { BenchmarkSelector } from '@/components/reports/BenchmarkSelector';
import { TimeRange, BENCHMARKS, Trade } from '@/types/trade';
import { PartialCloseRecord } from '@/hooks/useEquityCurveData';
import { useTrades } from '@/hooks/useTrades';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { subMonths, subYears, parseISO, isAfter } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const STARTING_CAPITAL_KEY = 'reports-starting-capital';

function getCutoffDate(timeRange: TimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case '1m':return subMonths(now, 1);
    case '3m':return subMonths(now, 3);
    case '6m':return subMonths(now, 6);
    case '1y':return subYears(now, 1);
    case '3y':return subYears(now, 3);
    default:return subMonths(now, 1);
  }
}

export default function Reports() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1m');
  const [barChartTimeRange, setBarChartTimeRange] = useState<TimeRange>('1m');
  const [lineChartBenchmarks, setLineChartBenchmarks] = useState<string[]>([]);
  const [barChartBenchmarks, setBarChartBenchmarks] = useState<string[]>([]);
  const [portfolioSelected, setPortfolioSelected] = useState(true);
  const [startingCapital, setStartingCapital] = useState<number>(() => {
    const saved = localStorage.getItem(STARTING_CAPITAL_KEY);
    return saved ? Number(saved) : 1000;
  });

  const [hasUserSavedCapital] = useState<boolean>(() => {
    return localStorage.getItem(STARTING_CAPITAL_KEY) !== null;
  });

  const { user } = useAuth();
  const { trades, closedTrades, isLoading } = useTrades();
  const { cashFlows } = usePortfolioCash();

  // Fetch partial closes for PnL calculations
  const { data: partialCloses = [] } = useQuery({
    queryKey: ['trade_partial_closes_reports', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.
      from('trade_partial_closes').
      select('id, trade_id, realized_pnl, lot_quantity, created_at').
      order('created_at', { ascending: true });
      if (error) throw error;
      return data as PartialCloseRecord[];
    },
    enabled: !!user
  });

  // Auto-set starting capital from first trade's position_amount
  useEffect(() => {
    if (hasUserSavedCapital) return;
    if (trades.length === 0) return;

    const sortedTrades = [...trades].sort(
      (a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime()
    );
    const firstTrade = sortedTrades[0];
    if (firstTrade?.position_amount) {
      setStartingCapital(firstTrade.position_amount);
    }
  }, [trades, hasUserSavedCapital]);

  const toggleLineChartBenchmark = (benchmarkId: string) => {
    setLineChartBenchmarks((prev) =>
    prev.includes(benchmarkId) ?
    prev.filter((id) => id !== benchmarkId) :
    [...prev, benchmarkId]
    );
  };

  const toggleBarChartBenchmark = (benchmarkId: string) => {
    setBarChartBenchmarks((prev) =>
    prev.includes(benchmarkId) ?
    prev.filter((id) => id !== benchmarkId) :
    [...prev, benchmarkId]
    );
  };

  // Stats calculation using partial closes
  const stats = useMemo(() => {
    const cutoff = getCutoffDate(selectedTimeRange);

    // PnL from partial closes in range
    const filteredPCs = partialCloses.filter((pc) =>
    isAfter(parseISO(pc.created_at), cutoff)
    );
    const totalPnL = filteredPCs.reduce((sum, pc) => sum + (pc.realized_pnl || 0), 0);

    // Distinct trade count from partial closes in range
    const tradeIds = new Set(filteredPCs.map((pc) => pc.trade_id));
    const totalTrades = tradeIds.size;

    // Success/fail from fully closed trades in range (final closing_type)
    const closedInRange = (closedTrades as Trade[]).filter(
      (t) => t.closed_at && t.status === 'closed' && isAfter(parseISO(t.closed_at), cutoff)
    );
    const successCount = closedInRange.filter((t) => t.closing_type === 'kar_al').length;
    const failCount = closedInRange.filter((t) => t.closing_type === 'stop').length;
    const winRate =
    successCount + failCount > 0 ?
    successCount / (successCount + failCount) * 100 :
    0;

    return { totalTrades, totalPnL, successCount, failCount, winRate: winRate.toFixed(1) };
  }, [partialCloses, closedTrades, selectedTimeRange]);

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

        {/* Başarılı / Başarısız */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-center h-full">
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className="w-3 h-3 text-profit" />
                <span className="text-xs text-muted-foreground">Başarılı</span>
              </div>
              <div className="text-2xl font-bold text-profit font-mono">
                {isLoading ? '-' : stats.successCount}
              </div>
            </div>
            <Separator orientation="vertical" className="h-10 mx-2" />
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <XCircle className="w-3 h-3 text-loss" />
                <span className="text-xs text-muted-foreground">Başarısız</span>
              </div>
              <div className="text-2xl font-bold text-loss font-mono">
                {isLoading ? '-' : stats.failCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart 1: % Çizgi Grafiği */}
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-foreground">% Çizgi Grafiği</h2>
          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onSelect={setSelectedTimeRange} />

        </div>

        <EquityCurveChart
          timeRange={selectedTimeRange}
          selectedBenchmarks={lineChartBenchmarks}
          benchmarks={BENCHMARKS}
          allTrades={trades as Trade[]}
          closedTrades={closedTrades as Trade[]}
          startingCapital={startingCapital}
          partialCloses={partialCloses} />


        <div className="mt-4 pt-4 border-t border-border">
          <BenchmarkSelector
            benchmarks={BENCHMARKS}
            selectedBenchmarks={lineChartBenchmarks}
            onToggle={toggleLineChartBenchmark} />

          



        </div>
      </div>

      {/* Chart 2: % Sütun Grafiği */}
      <ReturnComparisonChart
        timeRange={barChartTimeRange}
        onTimeRangeChange={setBarChartTimeRange}
        selectedBenchmarks={barChartBenchmarks}
        benchmarks={BENCHMARKS}
        closedTrades={closedTrades as Trade[]}
        allTrades={trades as Trade[]}
        startingCapital={startingCapital}
        partialCloses={partialCloses}
        portfolioSelected={portfolioSelected}>

        <div className="mt-4 pt-4 border-t border-border">
          <BenchmarkSelector
            benchmarks={BENCHMARKS}
            selectedBenchmarks={barChartBenchmarks}
            onToggle={toggleBarChartBenchmark}
            portfolioSelected={portfolioSelected}
            onPortfolioToggle={() => setPortfolioSelected((prev) => !prev)} />

          



        </div>
      </ReturnComparisonChart>

      {/* Chart 3: Portföy Değeri */}
      <PortfolioValueChart
        closedTrades={closedTrades as Trade[]}
        allTrades={trades as Trade[]}
        cashFlows={cashFlows}
        partialCloses={partialCloses} />

      {/* Chart 4: Varlıklarım */}
      <AssetsChart />

    </MainLayout>);

}