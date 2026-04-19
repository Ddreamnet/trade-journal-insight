import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Sector,
} from 'recharts';
import { Loader2, PieChart as PieIcon, TrendingUp } from 'lucide-react';

import { useUserAssets } from '@/hooks/useUserAssets';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useTrades } from '@/hooks/useTrades';
import {
  usePortfolioValueSnapshots,
  SnapshotRange,
} from '@/hooks/usePortfolioValueSnapshots';
import { getSymbolCurrency } from '@/lib/currency';

import { ShareChartButton } from '@/components/ui/ShareChartButton';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';

import { AssetsSeruvenChart } from './AssetsSeruvenChart';

// ─── Types & config ──────────────────────────────────────────────────────────

type DisplayMode = 'native' | 'TRY' | 'USD';
type NativeCurrency = 'TRY' | 'USD' | 'EUR';

const ASSET_LABELS: Record<string, string> = {
  tl_cash: 'TL Nakit', usd: 'USD', eur: 'EUR',
  konut: 'Konut', isyeri: 'İşyeri', arsa: 'Arsa',
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', altin: 'Altın', gumus: 'Gümüş',
  hisselerim: 'Hisselerim',
};

/** Per-asset color pair: [top stop, bottom stop] — drives radial gradient slices. */
const ASSET_COLORS: Record<string, [string, string]> = {
  tl_cash:    ['hsl(142,76%,36%)', 'hsl(142,76%,26%)'],
  usd:        ['hsl(152,60%,50%)', 'hsl(152,60%,35%)'],
  eur:        ['hsl(217,91%,65%)', 'hsl(217,91%,45%)'],
  konut:      ['hsl(38,92%,55%)',  'hsl(38,92%,40%)'],
  isyeri:     ['hsl(0,84%,65%)',   'hsl(0,84%,45%)'],
  arsa:       ['hsl(270,72%,65%)', 'hsl(270,72%,45%)'],
  bitcoin:    ['hsl(24,94%,58%)',  'hsl(24,94%,40%)'],
  ethereum:   ['hsl(239,84%,72%)', 'hsl(239,84%,50%)'],
  altin:      ['hsl(48,96%,58%)',  'hsl(48,96%,40%)'],
  gumus:      ['hsl(215,20%,70%)', 'hsl(215,20%,50%)'],
  hisselerim: ['hsl(196,86%,50%)', 'hsl(196,86%,32%)'],
};

const DEFAULT_COLORS: [string, string] = ['hsl(200,70%,55%)', 'hsl(200,70%,35%)'];

const CATEGORY_ORDER = ['stocks', 'cash', 'real_estate', 'commodity'] as const;
type Category = typeof CATEGORY_ORDER[number];

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  stocks:      { label: 'Hisseler',    color: 'hsl(196,70%,42%)' },
  cash:        { label: 'Nakit',       color: 'hsl(142,60%,36%)' },
  real_estate: { label: 'Gayrimenkul', color: 'hsl(38,85%,48%)'  },
  commodity:   { label: 'Emtia',       color: 'hsl(270,55%,58%)' },
};

const PIE_START = 90;
const PIE_PADDING = 3;

interface ChartEntry {
  key: string;
  name: string;
  /** Value expressed in USD — single unit for all slices' proportions. */
  value: number;
  colors: [string, string];
  pct: number;
  category?: string;
  nativeAmount: number;
  nativeCurrency: NativeCurrency;
}

// ─── Display helpers ─────────────────────────────────────────────────────────

function formatDisplay(item: ChartEntry, mode: DisplayMode, usdTryRate: number | null): string {
  if (mode === 'TRY' && usdTryRate) {
    return '₺' + (item.value * usdTryRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  }
  if (mode === 'USD') {
    return '$' + item.value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  // 'native' — show each slice in the currency it was entered in
  const { nativeAmount, nativeCurrency } = item;
  if (nativeCurrency === 'TRY') return '₺' + nativeAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  if (nativeCurrency === 'EUR') return '€' + nativeAmount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + nativeAmount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatTotal(totalUsd: number, mode: DisplayMode, usdTryRate: number | null): string {
  if (mode === 'TRY' && usdTryRate) {
    return '₺' + (totalUsd * usdTryRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  }
  return '$' + totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Break total into its literal native-currency buckets. "Ham" display mode
 * shows *what the user actually has in each currency*, not a converted total.
 * Returns one entry per currency that has a non-zero value.
 */
function nativeBreakdown(data: ChartEntry[]): Array<{ currency: NativeCurrency; amount: number }> {
  const groups: Record<NativeCurrency, number> = { TRY: 0, USD: 0, EUR: 0 };
  for (const item of data) {
    groups[item.nativeCurrency] += item.nativeAmount;
  }
  const out: Array<{ currency: NativeCurrency; amount: number }> = [];
  // Order: TRY, USD, EUR — keeps the output stable and predictable.
  if (groups.TRY > 0) out.push({ currency: 'TRY', amount: groups.TRY });
  if (groups.USD > 0) out.push({ currency: 'USD', amount: groups.USD });
  if (groups.EUR > 0) out.push({ currency: 'EUR', amount: groups.EUR });
  return out;
}

function formatNativeAmount({ currency, amount }: { currency: NativeCurrency; amount: number }): string {
  if (currency === 'TRY') return '₺' + amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  if (currency === 'EUR') return '€' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ─── Active slice shape ──────────────────────────────────────────────────────
// The selected slice thickens and grows, with a separate outer halo arc in its
// own color that advertises selection at a glance.
function ActiveShape(props: Record<string, unknown>) {
  const cx = props.cx as number;
  const cy = props.cy as number;
  const innerRadius = props.innerRadius as number;
  const outerRadius = props.outerRadius as number;
  const startAngle = props.startAngle as number;
  const endAngle = props.endAngle as number;
  const fill = props.fill as string;
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 12}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
        stroke="hsl(var(--background))"
        strokeWidth={3}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 16}
        outerRadius={outerRadius + 19}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
        opacity={0.55}
      />
    </g>
  );
}

// (Slice tooltip removed — the dynamic hero readout in the donut hole
// already shows name/value/percentage when a slice is active. A second
// pop-up box was redundant.)

// (Category pills removed — the grouped legend below the donut already
// carries the category-grouped breakdown with percentages, so a second
// summary row above the donut was duplicate information.)

// ─── Interactive legend ──────────────────────────────────────────────────────
function Legend({
  data, displayMode, usdTryRate, activeIndex, onActiveChange,
}: {
  data: ChartEntry[];
  displayMode: DisplayMode;
  usdTryRate: number | null;
  activeIndex: number | undefined;
  onActiveChange: (index: number | undefined) => void;
}) {
  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, meta: CATEGORY_META[cat], items: data.filter((d) => d.category === cat) }))
    .filter((g) => g.items.length > 0);
  const ungrouped = data.filter((d) => !CATEGORY_ORDER.includes((d.category ?? '') as Category));

  const renderRow = (item: ChartEntry) => {
    const idx = data.findIndex((d) => d.key === item.key);
    const isActive = activeIndex === idx;
    return (
      <button
        key={item.key}
        type="button"
        onMouseEnter={() => onActiveChange(idx)}
        onMouseLeave={() => onActiveChange(undefined)}
        onClick={() => onActiveChange(isActive ? undefined : idx)}
        className={cn(
          'flex items-center gap-2 min-w-0 w-full text-left rounded-lg px-2 py-1.5',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isActive ? 'bg-surface-3' : 'hover:bg-surface-2'
        )}
      >
        <span
          className={cn(
            'rounded-full flex-shrink-0 transition-all duration-150',
            isActive ? 'w-3 h-3' : 'w-2.5 h-2.5'
          )}
          style={{
            background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})`,
            boxShadow: isActive ? `0 0 0 2px hsl(var(--surface-1)), 0 0 0 3.5px ${item.colors[0]}` : undefined,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-label text-foreground truncate">{item.name}</div>
          <div className="text-caption text-muted-foreground font-mono">
            {formatDisplay(item, displayMode, usdTryRate)} · %{item.pct.toFixed(1)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="mt-4 px-2 space-y-3">
      {grouped.map(({ cat, meta, items }) => (
        <div key={cat}>
          <div className="flex items-center gap-1.5 mb-1 px-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
            <span className="text-caption" style={{ color: meta.color }}>{meta.label}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5">{items.map(renderRow)}</div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5">{ungrouped.map(renderRow)}</div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface AssetsChartProps {
  /** Portfolio ids to include; undefined = all user portfolios. */
  portfolioIds?: string[];
  /** Default portfolio for daily-snapshot writes. Undefined disables auto-save. */
  snapshotPortfolioId?: string;
}

export function AssetsChart({ portfolioIds, snapshotPortfolioId }: AssetsChartProps = {}) {
  const { assets, isLoading: assetsLoading } = useUserAssets(portfolioIds);
  const { availableCash } = usePortfolioCash(portfolioIds);
  const { getSeriesData, fetchSeries, isLoading: isSeriesLoading } = useMarketSeries();
  const { trades, isLoading: tradesLoading } = useTrades();
  const { getStockBySymbol } = useMarketData();

  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('native');
  const [seruvenMode, setSeruvenMode] = useState(false);
  const [snapshotRange, setSnapshotRange] = useState<SnapshotRange>('1M');

  const cardRef = useRef<HTMLDivElement>(null);
  const snapshotSavedRef = useRef(false);
  const { saveSnapshot } = usePortfolioValueSnapshots(snapshotRange, portfolioIds);

  useEffect(() => { fetchSeries('usd'); }, [fetchSeries]);

  const usdTryRate = useMemo(() => {
    const d = getSeriesData('usd');
    return d?.points?.length ? d.points[d.points.length - 1].value : null;
  }, [getSeriesData]);

  // ─── Data assembly ─────────────────────────────────────────────────────────

  const filteredTrades = useMemo(() => {
    if (!portfolioIds) return trades;
    const set = new Set(portfolioIds);
    return trades.filter((t) => set.has(t.portfolio_id));
  }, [trades, portfolioIds]);

  /** USD value of all active open positions across filtered trades. */
  const openPositionsUsd = useMemo(() => {
    let total = 0;
    for (const trade of filteredTrades) {
      if (trade.status !== 'active') continue;
      const lots = trade.remaining_lot;
      if (lots <= 0) continue;
      const stock = getStockBySymbol(trade.stock_symbol);
      const currentPrice = stock?.last ?? trade.entry_price;
      const currency = getSymbolCurrency(trade.stock_symbol);
      if (currency === 'USD') total += lots * currentPrice;
      else if (usdTryRate) total += (lots * currentPrice) / usdTryRate;
    }
    return total;
  }, [filteredTrades, getStockBySymbol, usdTryRate]);

  const chartData = useMemo<ChartEntry[]>(() => {
    const slices: Omit<ChartEntry, 'pct'>[] = [];

    if (openPositionsUsd > 0) {
      slices.push({
        key: 'hisselerim',
        name: 'Hisselerim',
        value: openPositionsUsd,
        colors: ASSET_COLORS.hisselerim,
        category: 'stocks',
        nativeAmount: openPositionsUsd,
        nativeCurrency: 'USD',
      });
    }

    if (availableCash > 0 && usdTryRate) {
      slices.push({
        key: 'tl_cash',
        name: 'TL Nakit',
        value: availableCash / usdTryRate,
        colors: ASSET_COLORS.tl_cash,
        category: 'cash',
        nativeAmount: availableCash,
        nativeCurrency: 'TRY',
      });
    }

    for (const asset of assets) {
      if (asset.amount_usd <= 0) continue;

      // Figure out how to display this slice in 'native' mode. Real estate
      // assets remember the original currency in their metadata; USD/EUR cash
      // assets keep their own currency; everything else is USD-denominated.
      const meta = asset.metadata as { native_currency?: string; native_amount?: number } | null;
      let nativeAmount = asset.amount_usd;
      let nativeCurrency: NativeCurrency = 'USD';

      if (asset.asset_type === 'eur') {
        nativeAmount = asset.quantity;
        nativeCurrency = 'EUR';
      } else if (asset.category === 'real_estate' && meta?.native_amount != null) {
        nativeAmount = meta.native_amount;
        nativeCurrency = meta.native_currency === 'TRY' ? 'TRY' : 'USD';
      }

      // Real estate items keep their own identity via asset.id so two "Konut"
      // entries don't collapse into one slice. Everything else groups by type.
      const key = asset.category === 'real_estate' && asset.title
        ? `re_${asset.id}`
        : asset.asset_type;
      const label = ASSET_LABELS[asset.asset_type] ?? asset.asset_type;
      const colors = ASSET_COLORS[asset.asset_type] ?? DEFAULT_COLORS;

      const existing = slices.find((s) => s.key === key);
      if (existing) {
        existing.value += asset.amount_usd;
        existing.nativeAmount += nativeAmount;
      } else {
        slices.push({
          key,
          name: label,
          value: asset.amount_usd,
          colors,
          category: asset.category,
          nativeAmount,
          nativeCurrency,
        });
      }
    }

    const total = slices.reduce((s, d) => s + d.value, 0);
    return slices.map((s) => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }));
  }, [assets, availableCash, usdTryRate, openPositionsUsd]);

  const sortedData = useMemo(() => [...chartData].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf((a.category ?? '') as Category);
    const bi = CATEGORY_ORDER.indexOf((b.category ?? '') as Category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  }), [chartData]);

  // Reset activeIndex whenever the slice list changes so we never point at a
  // slice that no longer exists.
  useEffect(() => {
    setActiveIndex(undefined);
  }, [sortedData.length]);

  const isLoading = assetsLoading || tradesLoading || isSeriesLoading('usd');
  const totalUsd = sortedData.reduce((s, d) => s + d.value, 0);
  const totalTry = usdTryRate ? totalUsd * usdTryRate : null;

  // Auto-save today's snapshot once per session when data is ready.
  useEffect(() => {
    if (isLoading || snapshotSavedRef.current || totalUsd <= 0) return;
    if (!snapshotPortfolioId) return;
    snapshotSavedRef.current = true;
    saveSnapshot.mutate({
      portfolioId: snapshotPortfolioId,
      valueUsd: totalUsd,
      valueTry: totalTry ?? undefined,
    });
  }, [isLoading, totalUsd, totalTry, snapshotPortfolioId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Interaction ───────────────────────────────────────────────────────────
  // Click-to-toggle only on the Pie itself. Hover handlers used to flicker
  // on mobile — taps would fire onMouseEnter immediately followed by
  // onMouseLeave, clearing the active index. Pure onClick is reliable on
  // both platforms. Desktop users still get hover previews via the legend.
  const onPieClick = useCallback(
    (_: unknown, i: number) =>
      setActiveIndex((current) => (current === i ? undefined : i)),
    []
  );

  const activeSlice = activeIndex !== undefined ? sortedData[activeIndex] ?? null : null;

  // ─── Center hero readout ───────────────────────────────────────────────────
  // The hero in the donut hole reacts to both the active slice and the
  // display-mode toggle. Three shapes it can take:
  //   1. A slice is active → name + its value in the current display mode + %
  //   2. Native (Ham) mode, no active slice → a *stacked breakdown* of the
  //      user's literal holdings, one line per currency (₺, $, €).
  //   3. TRY / USD mode, no active slice → a single converted total, with
  //      the opposite currency's equivalent as a small sub-line.
  const centerLabel = activeSlice?.name ?? 'Toplam Varlık';
  const breakdown = !activeSlice && displayMode === 'native'
    ? nativeBreakdown(sortedData)
    : null;
  const centerValue = activeSlice
    ? formatDisplay(activeSlice, displayMode, usdTryRate)
    : displayMode === 'native'
      ? null  // rendered separately as stacked multi-currency
      : formatTotal(totalUsd, displayMode, usdTryRate);
  const centerMeta = activeSlice
    ? `%${activeSlice.pct.toFixed(1)}`
    : displayMode === 'USD' && usdTryRate
      ? '₺' + (totalUsd * usdTryRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 })
      : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={cardRef}
      className="rounded-2xl bg-surface-1 border border-border-subtle overflow-hidden mt-3 md:mt-4 mb-3 md:mb-4"
    >
      {/* Header: title + Serüven toggle + Share (all compact, never wraps) */}
      <div className="px-4 md:px-5 pt-4 pb-2 md:pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <PieIcon className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-title text-foreground truncate">Varlıklarım</h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSeruvenMode((v) => !v)}
            aria-pressed={seruvenMode}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border transition-colors',
              'text-label',
              seruvenMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-surface-2 text-muted-foreground border-border-subtle hover:text-foreground'
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Serüven
          </button>
          <ShareChartButton targetRef={cardRef} filename="varliklarim" compact />
        </div>
      </div>

      {/* Display mode (Ham / ₺ / $) */}
      <div className="px-4 md:px-5 pb-3">
        <SegmentedControl
          value={displayMode}
          onChange={(v) => setDisplayMode(v as DisplayMode)}
          options={[
            { value: 'native', label: 'Ham' },
            { value: 'TRY', label: '₺ TL' },
            { value: 'USD', label: '$ USD' },
          ]}
          size="sm"
          stretch
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-label">Yükleniyor…</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && sortedData.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground px-4 text-center">
          <PieIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-body text-foreground">Henüz varlık kaydı yok.</p>
          <p className="text-label text-muted-foreground mt-1">
            "Portföy Ekle" ile varlık kaydedin.
          </p>
        </div>
      )}

      {/* Charts */}
      {!isLoading && sortedData.length > 0 && (seruvenMode ? (
        <AssetsSeruvenChart
          range={snapshotRange}
          setRange={setSnapshotRange}
          displayMode={displayMode}
          usdTryRate={usdTryRate}
          todayUsd={totalUsd}
          todayTry={totalTry}
        />
      ) : (
        <>
          <div className="relative select-none">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <defs>
                  {sortedData.map((entry, i) => (
                    <radialGradient key={entry.key} id={`slice-${i}`} cx="30%" cy="30%" r="78%">
                      <stop offset="0%"   stopColor={entry.colors[0]} stopOpacity={1} />
                      <stop offset="100%" stopColor={entry.colors[1]} stopOpacity={1} />
                    </radialGradient>
                  ))}
                </defs>
                <Pie
                  data={sortedData}
                  cx="50%" cy="50%"
                  innerRadius={74} outerRadius={118}
                  paddingAngle={PIE_PADDING}
                  dataKey="value" nameKey="name"
                  startAngle={PIE_START} endAngle={PIE_START - 360}
                  isAnimationActive
                  animationBegin={0}
                  animationDuration={600}
                  animationEasing="ease-out"
                  activeIndex={activeIndex}
                  activeShape={ActiveShape}
                  onClick={onPieClick}
                >
                  {sortedData.map((entry, i) => {
                    // Dim inactive slices via SVG `opacity` — cheap, no paint
                    // stalls unlike the CSS `filter` approach we used before.
                    const otherActive =
                      activeIndex !== undefined && activeIndex !== i;
                    return (
                      <Cell
                        key={entry.key}
                        fill={`url(#slice-${i})`}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                        opacity={otherActive ? 0.35 : 1}
                        style={{ cursor: 'pointer', outline: 'none' }}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Hero readout over the donut hole. Re-keys on active change
                to replay the fade-in animation. */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              aria-live="polite"
            >
              <div
                key={activeSlice?.key ?? `total-${displayMode}`}
                className="flex flex-col items-center px-4 text-center"
                style={{ animation: 'fade-in 200ms ease-out' }}
              >
                <div
                  className="text-caption"
                  style={{
                    color: activeSlice
                      ? activeSlice.colors[0]
                      : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {centerLabel}
                </div>

                {/* Ham (native) total, idle → stacked breakdown per currency.
                    `num-lg` for multi-line; single-line still reads big enough. */}
                {breakdown && breakdown.length > 0 && (
                  <div className="mt-0.5 flex flex-col items-center gap-0.5">
                    {breakdown.map((g) => (
                      <span key={g.currency} className="num-lg text-foreground">
                        {formatNativeAmount(g)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Active slice OR converted total (TRY/USD) → single big value. */}
                {centerValue && (
                  <div className="num-display text-foreground mt-0.5">
                    {centerValue}
                  </div>
                )}

                {centerMeta && (
                  <div className="text-label text-muted-foreground mt-0.5 font-mono">
                    {centerMeta}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Legend
            data={sortedData}
            displayMode={displayMode}
            usdTryRate={usdTryRate}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
          />
        </>
      ))}
    </div>
  );
}
