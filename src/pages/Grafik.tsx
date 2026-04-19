import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { StockLogo } from "@/components/ui/stock-logo";
import { StockSelector } from "@/components/trade/StockSelector";
import { BenchmarkPillRow, type BenchmarkOption } from "@/components/ui/benchmark-pill-row";
import {
  PriceChart,
  type PriceMarker,
  type OverlaySeries,
  type CrosshairReadout,
} from "@/components/chart/PriceChart";

import { useStockHistory, type PricePoint } from "@/hooks/useStockHistory";
import { useTrades } from "@/hooks/useTrades";
import { useMarketData } from "@/contexts/MarketDataContext";
import { useMarketSeries } from "@/contexts/MarketSeriesContext";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { cn } from "@/lib/utils";
import { format, parseISO, subMonths, subYears } from "date-fns";
import { tr } from "date-fns/locale";
import { MarketAsset } from "@/types/market";
import { Stock } from "@/types/trade";

type Timeframe = "1m" | "3m" | "6m" | "1y" | "3y";

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1A" },
  { value: "3m", label: "3A" },
  { value: "6m", label: "6A" },
  { value: "1y", label: "1Y" },
  { value: "3y", label: "3Y" },
];

interface BenchmarkConfig {
  id: MarketAsset;
  label: string;
  color: string;
}

const BENCHMARK_OPTIONS: BenchmarkConfig[] = [
  { id: "bist100", label: "BIST 100", color: "hsl(4, 83%, 62%)" },
  { id: "usd", label: "Dolar", color: "hsl(142, 40%, 60%)" },
  { id: "gold", label: "Altın", color: "hsl(44, 92%, 60%)" },
  { id: "inflation_tr", label: "TÜFE", color: "hsl(22, 95%, 62%)" },
  { id: "nasdaq100", label: "NASDAQ", color: "hsl(198, 88%, 60%)" },
];

const DEFAULT_SYMBOL_KEY = "grafik.lastSymbol";

function cutoffFor(tf: Timeframe): Date {
  const now = new Date();
  switch (tf) {
    case "1m": return subMonths(now, 1);
    case "3m": return subMonths(now, 3);
    case "6m": return subMonths(now, 6);
    case "1y": return subYears(now, 1);
    case "3y": return subYears(now, 3);
  }
}

function sliceByTimeframe(points: PricePoint[], tf: Timeframe): PricePoint[] {
  if (!points.length) return [];
  const cutoff = cutoffFor(tf);
  return points.filter((p) => parseISO(p.date) >= cutoff);
}

/**
 * Rescale a secondary series so its first point matches the primary series'
 * first point. Used to overlay benchmarks on the same axis as a stock price —
 * the resulting chart reads as "what would this benchmark look like if it
 * started at the stock's price on day 1?"
 */
function normalizeToAnchor(
  points: PricePoint[],
  anchorValue: number
): PricePoint[] {
  if (!points.length) return [];
  const first = points[0].value;
  if (first === 0) return points;
  const ratio = anchorValue / first;
  return points.map((p) => ({ date: p.date, value: p.value * ratio }));
}

function formatTL(v: number): string {
  return `₺${v.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: tr });
  } catch {
    return iso;
  }
}

/**
 * Grafik — dedicated stock chart surface.
 *
 * Mobile-first layout:
 *   [Symbol header + price readout] ← scrub readout lives here
 *   [Timeframe segmented control ]
 *   [Full-bleed PriceChart        ]
 *   [Benchmark pill row           ]
 *   [Your trades on this symbol   ]
 */
export default function Grafik() {
  const { activeTrades, closedTradeEntries } = useTrades();
  const { getStockBySymbol, stocks } = useMarketData();
  const { getSeriesData, fetchSeries } = useMarketSeries();
  const { activeSelection } = usePortfolioContext();

  // ── Symbol selection state ─────────────────────────────────────
  const [symbol, setSymbol] = useState<string>(() => {
    const stored = localStorage.getItem(DEFAULT_SYMBOL_KEY);
    if (stored) return stored;
    return "";
  });
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("6m");
  const [benchmarks, setBenchmarks] = useState<Set<MarketAsset>>(new Set());
  const [readout, setReadout] = useState<CrosshairReadout | null>(null);

  // Initialize symbol from the user's most recent trade if nothing stored
  useEffect(() => {
    if (symbol) return;
    const scopedActive = activeTrades.filter(
      (t) =>
        activeSelection === "all" ||
        activeSelection === null ||
        t.portfolio_id === activeSelection
    );
    const first = scopedActive[0] ?? activeTrades[0];
    if (first) {
      setSymbol(first.stock_symbol);
    } else if (stocks.length > 0) {
      const fallback = stocks.find((s) => s.symbol === "THYAO") ?? stocks[0];
      setSymbol(fallback.symbol);
    }
  }, [symbol, activeTrades, stocks, activeSelection]);

  // Persist symbol choice
  useEffect(() => {
    if (symbol) localStorage.setItem(DEFAULT_SYMBOL_KEY, symbol);
  }, [symbol]);

  // ── Data fetching ─────────────────────────────────────────────
  const history = useStockHistory(symbol);
  const marketStock = symbol ? getStockBySymbol(symbol) : null;

  // Fetch any selected benchmark series when the selection changes
  useEffect(() => {
    benchmarks.forEach((id) => void fetchSeries(id));
  }, [benchmarks, fetchSeries]);

  // ── Derived chart data ────────────────────────────────────────
  const visiblePoints = useMemo(
    () => sliceByTimeframe(history.points, timeframe),
    [history.points, timeframe]
  );

  const anchor = visiblePoints.length ? visiblePoints[0].value : null;

  const overlaySeriesList = useMemo<OverlaySeries[]>(() => {
    if (!anchor) return [];
    const list: OverlaySeries[] = [];
    benchmarks.forEach((id) => {
      const config = BENCHMARK_OPTIONS.find((b) => b.id === id);
      if (!config) return;
      const series = getSeriesData(id);
      if (!series || !series.points.length) return;
      const cutoff = cutoffFor(timeframe);
      const sliced = series.points.filter((p) => parseISO(p.date) >= cutoff);
      if (!sliced.length) return;
      list.push({
        id,
        label: config.label,
        color: config.color,
        points: normalizeToAnchor(sliced, anchor),
      });
    });
    return list;
  }, [anchor, benchmarks, getSeriesData, timeframe]);

  // ── Trade markers for this symbol ─────────────────────────────
  const markers = useMemo<PriceMarker[]>(() => {
    if (!symbol) return [];
    const list: PriceMarker[] = [];

    // Entries: all trades with this symbol
    const scopedTrades = [...activeTrades];
    scopedTrades.forEach((t) => {
      if (t.stock_symbol !== symbol) return;
      list.push({
        id: `trade:${t.id}:entry`,
        time: t.created_at.slice(0, 10),
        side: t.trade_type === "buy" ? "buy" : "sell",
        text: `${t.trade_type === "buy" ? "AL" : "SAT"} · ${t.lot_quantity} lot`,
      });
    });

    // Exits: partial closes with this symbol
    closedTradeEntries.forEach((pc) => {
      if (pc.stock_symbol !== symbol) return;
      // Closing a buy position = sell action, closing a sell = buy action
      const side: "buy" | "sell" = pc.trade_type === "buy" ? "sell" : "buy";
      list.push({
        id: `partial:${pc.id}`,
        time: pc.created_at.slice(0, 10),
        side,
        text: `${side === "buy" ? "AL" : "SAT"} · ${pc.lot_quantity} lot`,
      });
    });

    return list;
  }, [symbol, activeTrades, closedTradeEntries]);

  // ── Header readout (reflects scrub when active) ────────────────
  const headerReadout = useMemo(() => {
    if (readout) {
      return {
        date: readout.date,
        value: readout.value,
        overlays: readout.overlays,
        isLive: false,
      };
    }
    const lastClose = history.lastClose;
    const firstVisible = visiblePoints.length ? visiblePoints[0].value : null;
    const chgPct =
      lastClose !== null && firstVisible !== null && firstVisible !== 0
        ? ((lastClose - firstVisible) / firstVisible) * 100
        : null;
    const chgAbs =
      lastClose !== null && firstVisible !== null
        ? lastClose - firstVisible
        : null;
    return {
      date: history.points.length
        ? history.points[history.points.length - 1].date
        : null,
      value: lastClose,
      chgPct,
      chgAbs,
      isLive: true,
    };
  }, [readout, history.lastClose, history.points, visiblePoints]);

  // Live % and abs change relative to the visible range's first point
  const liveDelta = useMemo(() => {
    if (!headerReadout.isLive || headerReadout.value === null || !anchor) {
      return null;
    }
    const chgAbs = headerReadout.value - anchor;
    const chgPct = anchor === 0 ? 0 : (chgAbs / anchor) * 100;
    return { chgAbs, chgPct };
  }, [headerReadout, anchor]);

  // Scrub delta vs. first visible point
  const scrubDelta = useMemo(() => {
    if (headerReadout.isLive || readout?.value === null || !anchor) return null;
    const v = readout!.value!;
    const chgAbs = v - anchor;
    const chgPct = anchor === 0 ? 0 : (chgAbs / anchor) * 100;
    return { chgAbs, chgPct };
  }, [headerReadout.isLive, readout, anchor]);

  const delta = liveDelta ?? scrubDelta;
  const isUp = delta ? delta.chgAbs >= 0 : true;

  // ── Handlers ─────────────────────────────────────────────────
  const handleStockSelect = (stock: Stock & { logoUrl?: string }) => {
    setSymbol(stock.symbol);
    setReadout(null);
  };

  const toggleBenchmark = (id: MarketAsset) => {
    setBenchmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCrosshair = useCallback((r: CrosshairReadout | null) => {
    setReadout(r);
  }, []);

  return (
    <MainLayout hideTicker>
      <PageHeader
        title="Grafik"
        description="Hisse grafiği · işlem analizi"
        spacing="sm"
      />

      {/* SYMBOL HEADER — tap to change, doubles as scrub readout */}
      <button
        type="button"
        onClick={() => setIsSelectorOpen(true)}
        className={cn(
          "w-full text-left rounded-2xl surface-1 p-4",
          "hover:bg-surface-2 transition-colors",
          "active:scale-[0.995]"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {symbol ? (
              <StockLogo symbol={symbol} logoUrl={marketStock?.logoUrl} size="md" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-surface-3" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-title-lg text-foreground">
                  {symbol || "Sembol seçin"}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-label text-muted-foreground truncate">
                {marketStock?.name ?? (symbol ? "—" : "Seçmek için dokunun")}
              </div>
            </div>
          </div>

          {headerReadout.value !== null && (
            <div className="text-right shrink-0">
              <div className="num-lg text-foreground">
                {formatTL(headerReadout.value)}
              </div>
              {delta && (
                <div
                  className={cn(
                    "num-sm font-semibold",
                    isUp ? "text-profit" : "text-loss"
                  )}
                >
                  {isUp ? "+" : "−"}₺{Math.abs(delta.chgAbs).toFixed(2)} ·{" "}
                  {isUp ? "+" : ""}
                  {delta.chgPct.toFixed(2)}%
                </div>
              )}
              <div className="text-caption text-muted-foreground">
                {headerReadout.isLive ? "Son kapanış" : formatDate(headerReadout.date ?? "")}
              </div>
            </div>
          )}
        </div>
      </button>

      {/* TIMEFRAME */}
      <div className="mt-3">
        <SegmentedControl
          value={timeframe}
          onChange={(v) => setTimeframe(v as Timeframe)}
          options={TIMEFRAME_OPTIONS}
          aria-label="Zaman aralığı"
        />
      </div>

      {/* CHART */}
      <div className="mt-3 rounded-2xl surface-1 p-2 overflow-hidden">
        {history.isLoading ? (
          <Skeleton className="h-[380px] w-full rounded-xl" />
        ) : history.isError ? (
          <ChartError message="Fiyat verisi alınamadı." />
        ) : history.points.length === 0 ? (
          <ChartError message="Bu sembol için geçmiş veri bulunamadı." />
        ) : (
          <PriceChart
            points={visiblePoints}
            markers={markers}
            overlays={overlaySeriesList}
            onCrosshairMove={handleCrosshair}
            height={380}
          />
        )}
      </div>

      {/* BENCHMARK PILLS */}
      <div className="mt-3">
        <BenchmarkPillRow<MarketAsset>
          options={BENCHMARK_OPTIONS.map<BenchmarkOption<MarketAsset>>((b) => {
            const active = benchmarks.has(b.id);
            const v = active ? readout?.overlays[b.id] : null;
            return {
              id: b.id,
              label: b.label,
              color: b.color,
              trailing:
                v != null ? (
                  <span className="num-sm text-foreground">₺{v.toFixed(2)}</span>
                ) : null,
            };
          })}
          selected={benchmarks}
          onToggle={toggleBenchmark}
        />
      </div>

      {/* MARKER LEGEND */}
      {markers.length > 0 && (
        <div className="mt-3 text-caption text-muted-foreground flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent"
              style={{ borderBottomColor: "hsl(151, 64%, 43%)" }}
            />
            <span>Alış ({markers.filter((m) => m.side === "buy").length})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent"
              style={{ borderTopColor: "hsl(0, 78%, 58%)" }}
            />
            <span>Satış ({markers.filter((m) => m.side === "sell").length})</span>
          </span>
        </div>
      )}

      {/* STOCK SELECTOR (shared primitive) */}
      <StockSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={handleStockSelect}
      />
    </MainLayout>
  );
}

function ChartError({ message }: { message: string }) {
  return (
    <div className="h-[380px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-body text-foreground">{message}</p>
      <p className="text-label text-muted-foreground mt-1">
        Farklı bir sembol seçin veya daha sonra tekrar deneyin.
      </p>
    </div>
  );
}
