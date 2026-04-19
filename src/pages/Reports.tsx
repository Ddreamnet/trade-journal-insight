import { useState, useMemo, useRef, useCallback } from 'react';
import {
  BarChart3,
  Trophy,
  Wallet,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ChartCard } from '@/components/ui/chart-card';
import {
  BenchmarkPillRow,
  type BenchmarkOption,
} from '@/components/ui/benchmark-pill-row';
import { ShareChartButton } from '@/components/ui/ShareChartButton';
import { Skeleton } from '@/components/ui/skeleton';

import { EquityCurveChart } from '@/components/reports/EquityCurveChart';
import { ReturnComparisonChart } from '@/components/reports/ReturnComparisonChart';
import { PortfolioValueChart } from '@/components/reports/PortfolioValueChart';
import { AssetsChart } from '@/components/reports/AssetsChart';
import { StockComparisonChart } from '@/components/reports/StockComparisonChart';

import { TimeRange, BENCHMARKS, Trade, TIME_RANGES, ClosedTradeEntry } from '@/types/trade';
import {
  PartialCloseRecord,
  useEquityCurveData,
  getTimeRangeDates,
  ChartDataPoint,
} from '@/hooks/useEquityCurveData';
import { useStockPriceSeries } from '@/hooks/useStockPriceSeries';
import { useTrades } from '@/hooks/useTrades';
import { getClosedRR } from '@/lib/tradeUtils';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { usePortfolioContext } from '@/contexts/PortfolioContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

/**
 * Rapor — performance & allocation analytics.
 *
 * On mobile this page uses a "bleed to edges" layout pattern: main has
 * less horizontal padding than other pages so charts can fill more of the
 * viewport. Each chart is wrapped in a ChartCard whose body is edge-to-edge,
 * giving each chart >85% of screen width on a typical phone.
 *
 * Top-to-bottom reading order:
 *   1. Header + portfolio filter
 *   2. Four metric cards (the headline numbers)
 *   3. Equity curve (the page's hero chart — always expanded)
 *   4. Return comparison
 *   5. Portfolio value
 *   6. Assets / allocation
 *   7. Stock comparison
 *
 * Mobile users see #3 fully, and #4–7 collapsed. Tapping expands them and
 * defers the chart render until that moment — keeping first paint fast.
 */
export default function Reports() {
  const isMobile = useIsMobile();
  const equityCardRef = useRef<HTMLElement>(null);
  const returnCardRef = useRef<HTMLElement>(null);
  const valueCardRef = useRef<HTMLElement>(null);

  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1m');
  const [barChartTimeRange, setBarChartTimeRange] = useState<TimeRange>('1m');
  const [lineChartBenchmarks, setLineChartBenchmarks] = useState<Set<string>>(
    new Set()
  );
  const [barChartBenchmarks, setBarChartBenchmarks] = useState<Set<string>>(
    new Set()
  );
  const [portfolioSelected, setPortfolioSelected] = useState(true);

  const {
    trades: allTradesRaw,
    closedTrades: allClosedTradesRaw,
    partialCloses: allPartialClosesRaw,
    closedTradeEntries: allClosedEntriesRaw,
    isLoading,
  } = useTrades();
  const { activeSelection, portfolios } = usePortfolioContext();

  // Reports is driven entirely by the global portfolio selector in the
  // header. 'all' (or no selection) includes every portfolio; a specific
  // id filters to that single portfolio. No separate filter UI on this
  // page — the header selection is the single source of truth.
  const reportPortfolioIds = useMemo<string[]>(() => {
    if (activeSelection === 'all' || activeSelection === null) {
      return portfolios.map((p) => p.id);
    }
    return [activeSelection];
  }, [activeSelection, portfolios]);

  const { cashFlows } = usePortfolioCash(reportPortfolioIds);

  const portfolioIdSet = useMemo(
    () => new Set(reportPortfolioIds),
    [reportPortfolioIds]
  );

  const trades = useMemo(
    () => (allTradesRaw as Trade[]).filter((t) => portfolioIdSet.has(t.portfolio_id)),
    [allTradesRaw, portfolioIdSet]
  );
  const closedTrades = useMemo(
    () =>
      (allClosedTradesRaw as Trade[]).filter((t) =>
        portfolioIdSet.has(t.portfolio_id)
      ),
    [allClosedTradesRaw, portfolioIdSet]
  );

  const partialCloses = useMemo<PartialCloseRecord[]>(
    () =>
      allPartialClosesRaw
        .filter((pc) => portfolioIdSet.has(pc.portfolio_id))
        .map((pc) => ({
          id: pc.id,
          trade_id: pc.trade_id,
          realized_pnl: pc.realized_pnl,
          lot_quantity: pc.lot_quantity,
          created_at: pc.created_at,
        })),
    [allPartialClosesRaw, portfolioIdSet]
  );

  const closedEntries = useMemo<ClosedTradeEntry[]>(
    () => allClosedEntriesRaw.filter((e) => portfolioIdSet.has(e.portfolio_id)),
    [allClosedEntriesRaw, portfolioIdSet]
  );

  // Starting capital for the equity-curve normalization: the earliest trade's
  // position_amount from the currently-filtered portfolio. Derived with
  // useMemo so switching portfolios is synchronous with the trades change —
  // no one-frame flash with a stale value from the previous selection.
  const startingCapital = useMemo(() => {
    if (trades.length === 0) return 1000;
    let earliest: Trade | null = null;
    for (const t of trades) {
      if (!earliest || parseISO(t.created_at) < parseISO(earliest.created_at)) {
        earliest = t;
      }
    }
    return earliest?.position_amount || 1000;
  }, [trades]);

  const toggleLineChartBenchmark = useCallback((benchmarkId: string) => {
    setLineChartBenchmarks((prev) => {
      const next = new Set(prev);
      if (next.has(benchmarkId)) next.delete(benchmarkId);
      else next.add(benchmarkId);
      return next;
    });
  }, []);

  const toggleBarChartBenchmark = useCallback((benchmarkId: string) => {
    setBarChartBenchmarks((prev) => {
      const next = new Set(prev);
      if (next.has(benchmarkId)) next.delete(benchmarkId);
      else next.add(benchmarkId);
      return next;
    });
  }, []);

  // Stats are lifetime totals for the filtered portfolio. Each partial
  // close — whether a partial or a full exit — counts as one "işlem
  // sonucu", which keeps the four numbers consistent:
  // totalTrades = successCount + failCount, and PnL/RR accumulate over
  // the same set the counts describe. The chart time-range selector
  // controls chart zoom only; it does not scope these headline numbers.
  const stats = useMemo(() => {
    const totalTrades = closedEntries.length;
    const successCount = closedEntries.filter((e) => e.closing_type === 'kar_al').length;
    const failCount = closedEntries.filter((e) => e.closing_type === 'stop').length;
    const totalPnL = closedEntries.reduce((sum, e) => sum + (e.realized_pnl || 0), 0);
    const totalRR = closedEntries.reduce((sum, e) => sum + (getClosedRR(e) ?? 0), 0);
    const winRate =
      totalTrades > 0 ? (successCount / totalTrades) * 100 : 0;
    return {
      totalTrades,
      totalPnL,
      successCount,
      failCount,
      winRate: Number(winRate.toFixed(1)),
      totalRR,
    };
  }, [closedEntries]);

  // For the daily snapshot writer: when a single portfolio is explicitly
  // selected, write snapshots to that one. If the user is on "Tümü" but
  // only has one portfolio, use it; otherwise skip snapshot writes.
  const snapshotPortfolioId =
    typeof activeSelection === 'string' && activeSelection !== 'all'
      ? activeSelection
      : (activeSelection === 'all' || activeSelection === null) && portfolios.length === 1
        ? portfolios[0].id
        : undefined;

  const filterLabel = useMemo(() => {
    if (activeSelection === 'all' || activeSelection === null) return 'Tüm portföyler';
    const p = portfolios.find((x) => x.id === activeSelection);
    return p?.name ?? 'Portföy';
  }, [activeSelection, portfolios]);

  const benchmarkOptions = useMemo<BenchmarkOption<string>[]>(
    () =>
      BENCHMARKS.map((b) => ({
        id: b.id,
        label: b.name,
        color: b.color,
      })),
    []
  );

  const timeRangeOptions = TIME_RANGES.map((r) => ({
    value: r.id,
    label: r.label,
  }));

  return (
    <MainLayout>
      {/* Pull charts toward the viewport edges on mobile — every pixel of
          chart width matters on a small screen. */}
      <div className="-mx-3 md:mx-0 px-3 md:px-0">
        <div className="px-1 md:px-0">
          <PageHeader
            title="Rapor"
            description={
              <>
                Performans analizi ·{' '}
                <span className="text-foreground font-medium">{filterLabel}</span>
              </>
            }
            spacing="md"
          />

          {/* METRIC CARDS */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-5">
            <SplitMetricCard
              left={{
                label: 'Toplam İşlem',
                icon: BarChart3,
                iconClass: 'text-primary',
                value: isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <span className="text-foreground">{stats.totalTrades}</span>
                ),
              }}
              right={{
                label: 'Toplam RR',
                icon: TrendingUp,
                iconClass:
                  stats.totalRR >= 0 ? 'text-profit' : 'text-loss',
                value: isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span
                    className={stats.totalRR >= 0 ? 'text-profit' : 'text-loss'}
                  >
                    {stats.totalRR.toFixed(2)}
                  </span>
                ),
              }}
            />
            <MetricCard
              label="Başarı Oranı"
              value={
                isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <span
                    className={stats.winRate >= 50 ? 'text-profit' : 'text-loss'}
                  >
                    %{stats.winRate}
                  </span>
                )
              }
              icon={Trophy}
            />
            <MetricCard
              label="Gerçekleşen K/Z"
              value={
                isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <span
                    className={
                      stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'
                    }
                  >
                    {stats.totalPnL >= 0 ? '+' : ''}₺
                    {stats.totalPnL.toFixed(0)}
                  </span>
                )
              }
              icon={Wallet}
            />
            <SplitMetricCard
              left={{
                label: 'Başarılı',
                icon: CheckCircle2,
                iconClass: 'text-profit',
                value: isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <span className="text-profit">{stats.successCount}</span>
                ),
              }}
              right={{
                label: 'Başarısız',
                icon: XCircle,
                iconClass: 'text-loss',
                value: isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  <span className="text-loss">{stats.failCount}</span>
                ),
              }}
            />
          </section>
        </div>

        {/* CHART 1 — Equity curve (hero, always expanded) */}
        <ChartCard
          ref={equityCardRef}
          title="Portföy Eğrisi"
          subtitle="Başlangıç endeksli · 100 = başlangıç"
          titleTrailing={
            <ShareChartButton
              targetRef={
                equityCardRef as unknown as React.RefObject<HTMLDivElement>
              }
              filename="portfoy-egrisi"
              compact
            />
          }
          headerSlot={
            <SegmentedControl
              value={selectedTimeRange}
              onChange={(v) => setSelectedTimeRange(v as TimeRange)}
              options={timeRangeOptions}
              size="sm"
              stretch
              aria-label="Zaman aralığı"
            />
          }
          footer={
            <BenchmarkPillRow<string>
              options={benchmarkOptions}
              selected={lineChartBenchmarks}
              onToggle={toggleLineChartBenchmark}
              bleedOnMobile={false}
            />
          }
          className="mb-3"
        >
          <EquityCurveChart
            timeRange={selectedTimeRange}
            selectedBenchmarks={Array.from(lineChartBenchmarks)}
            benchmarks={BENCHMARKS}
            allTrades={trades as Trade[]}
            closedTrades={closedTrades as Trade[]}
            startingCapital={startingCapital}
            partialCloses={partialCloses}
            height={isMobile ? 260 : 360}
          />
        </ChartCard>

        {/* CHART 2 — Return comparison (collapsed by default on mobile) */}
        <ChartCard
          ref={returnCardRef}
          title="Getiri Karşılaştırması"
          subtitle="Seçili aralıkta toplam getiri"
          collapsible={isMobile}
          defaultOpen={!isMobile}
          titleTrailing={
            !isMobile ? (
              <ShareChartButton
                targetRef={
                  returnCardRef as unknown as React.RefObject<HTMLDivElement>
                }
                filename="getiri-karsilastirma"
                compact
              />
            ) : undefined
          }
          headerSlot={
            <SegmentedControl
              value={barChartTimeRange}
              onChange={(v) => setBarChartTimeRange(v as TimeRange)}
              options={timeRangeOptions}
              size="sm"
              stretch
              aria-label="Zaman aralığı"
            />
          }
          footer={
            <BenchmarkPillRow<string>
              options={benchmarkOptions}
              selected={barChartBenchmarks}
              onToggle={toggleBarChartBenchmark}
              leading={{
                id: 'portfolio',
                label: 'Portföy',
                color: 'hsl(217, 91%, 60%)',
                active: portfolioSelected,
                onToggle: () => setPortfolioSelected((prev) => !prev),
              }}
              bleedOnMobile={false}
            />
          }
          collapsedSlot={
            <ReturnChipSummary
              timeRange={barChartTimeRange}
              selectedBenchmarks={Array.from(barChartBenchmarks)}
              benchmarks={BENCHMARKS}
              portfolioSelected={portfolioSelected}
              trades={trades as Trade[]}
              closedTrades={closedTrades as Trade[]}
              startingCapital={startingCapital}
              partialCloses={partialCloses}
            />
          }
          className="mb-3"
        >
          <ReturnComparisonChart
            timeRange={barChartTimeRange}
            selectedBenchmarks={Array.from(barChartBenchmarks)}
            benchmarks={BENCHMARKS}
            closedTrades={closedTrades as Trade[]}
            allTrades={trades as Trade[]}
            startingCapital={startingCapital}
            partialCloses={partialCloses}
            portfolioSelected={portfolioSelected}
            height={isMobile ? 220 : 260}
          />
        </ChartCard>

        {/* CHART 3 — Portfolio value */}
        <ChartCard
          ref={valueCardRef}
          title="Portföy Değeri"
          subtitle="Bakiye + açık pozisyonların market değeri"
          collapsible={isMobile}
          defaultOpen={!isMobile}
          className="mb-3"
          titleTrailing={
            <ShareChartButton
              targetRef={
                valueCardRef as unknown as React.RefObject<HTMLDivElement>
              }
              filename="portfoy-degeri"
              compact
            />
          }
        >
          <PortfolioValueChart
            closedTrades={closedTrades as Trade[]}
            allTrades={trades as Trade[]}
            cashFlows={cashFlows}
            partialCloses={partialCloses}
            height={isMobile ? 260 : 340}
          />
        </ChartCard>

        {/* CHART 4 — Assets / allocation (keeps internal chrome; complex mode toggles) */}
        <AssetsChart
          portfolioIds={reportPortfolioIds}
          snapshotPortfolioId={snapshotPortfolioId}
        />

        {/* CHART 5 — Stock comparison (keeps internal chrome; stock picker) */}
        <StockComparisonChart />
      </div>
    </MainLayout>
  );
}

/**
 * SplitMetricCard — two metrics sharing one card, separated by a thin rule.
 * Used when pairs of numbers are naturally read together (e.g. "Başarılı /
 * Başarısız") — halves the card count without sacrificing scannability.
 */
interface SplitPane {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  value: React.ReactNode;
}

function SplitMetricCard({ left, right }: { left: SplitPane; right: SplitPane }) {
  return (
    <div className="rounded-xl bg-surface-2 border border-border-subtle p-4">
      <div className="flex items-stretch gap-3">
        {[left, right].map((pane, idx) => {
          const Icon = pane.icon;
          return (
            <div
              key={pane.label}
              className={cn(
                'flex-1 min-w-0',
                idx === 1 && 'border-l border-border-subtle pl-3'
              )}
            >
              <div className="flex items-center gap-1.5 text-label text-muted-foreground">
                <Icon className={cn('w-3.5 h-3.5', pane.iconClass)} />
                <span className="truncate">{pane.label}</span>
              </div>
              <div className="mt-1 num-lg">{pane.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ReturnChipSummary — compact summary shown inside the Return Comparison
 * card while it's collapsed on mobile. Gives the user a glance at the
 * period's outcomes without forcing them to open the full chart.
 */
function ReturnChipSummary({
  timeRange,
  selectedBenchmarks,
  benchmarks,
  portfolioSelected,
  trades,
  closedTrades,
  startingCapital,
  partialCloses,
}: {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: typeof BENCHMARKS;
  portfolioSelected: boolean;
  trades: Trade[];
  closedTrades: Trade[];
  startingCapital: number;
  partialCloses: PartialCloseRecord[];
}) {
  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    [timeRange]
  );
  const { priceMap } = useStockPriceSeries(trades, startDate, endDate);
  const { chartData } = useEquityCurveData(
    timeRange,
    selectedBenchmarks,
    closedTrades,
    startingCapital,
    partialCloses,
    trades,
    priceMap,
    []
  );

  type Row = { id: string; name: string; value: number; color: string };
  const rows: Row[] = [];

  const firstLast = (pick: (p: ChartDataPoint) => number | null | undefined) => {
    let first: number | null = null;
    let last: number | null = null;
    for (const p of chartData) {
      const v = pick(p);
      if (v !== null && v !== undefined) {
        if (first === null) first = v;
        last = v;
      }
    }
    return { first, last };
  };

  if (portfolioSelected) {
    const fl = firstLast((p) => p.portfolioIndex);
    if (fl.first && fl.last) {
      rows.push({
        id: 'portfolio',
        name: 'Portföy',
        value: (fl.last / fl.first - 1) * 100,
        color: 'hsl(217, 91%, 60%)',
      });
    }
  }
  selectedBenchmarks.forEach((id) => {
    const b = benchmarks.find((x) => x.id === id);
    if (!b) return;
    const fl = firstLast(
      (p) =>
        (p as unknown as Record<string, number | null | undefined>)[id]
    );
    if (fl.first && fl.last) {
      rows.push({
        id,
        name: b.name,
        value: (fl.last / fl.first - 1) * 100,
        color: b.color,
      });
    }
  });

  if (!rows.length) {
    return (
      <p className="text-label text-muted-foreground">
        Karşılaştırmak için portföy veya benchmark seçin.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((r) => {
        const up = r.value >= 0;
        return (
          <span
            key={r.id}
            className={cn(
              'inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-label',
              'bg-surface-2 border border-border-subtle'
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: r.color }}
            />
            <span className="text-foreground">{r.name}</span>
            <span
              className={cn(
                'num-sm font-semibold',
                up ? 'text-profit' : 'text-loss'
              )}
            >
              {up ? (
                <ArrowUpRight className="w-3 h-3 inline" />
              ) : (
                <ArrowDownRight className="w-3 h-3 inline" />
              )}
              {up ? '+' : ''}
              {r.value.toFixed(1)}%
            </span>
          </span>
        );
      })}
    </div>
  );
}
