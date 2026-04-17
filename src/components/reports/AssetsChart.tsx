import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector, Customized,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { useUserAssets } from '@/hooks/useUserAssets';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useTrades } from '@/hooks/useTrades';
import { usePortfolioValueSnapshots, SnapshotRange } from '@/hooks/usePortfolioValueSnapshots';
import { getSymbolCurrency } from '@/lib/currency';
import { Loader2, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { ShareChartButton } from '@/components/ui/ShareChartButton';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

type DisplayMode = 'native' | 'TRY' | 'USD';
type NativeCurrency = 'TRY' | 'USD' | 'EUR';

export const ASSET_LABELS: Record<string, string> = {
  tl_cash: 'TL Nakit', usd: 'USD', eur: 'EUR',
  konut: 'Konut', isyeri: 'İşyeri', arsa: 'Arsa',
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', altin: 'Altın', gumus: 'Gümüş',
  hisselerim: 'Hisselerim',
};

export const ASSET_COLORS: Record<string, [string, string]> = {
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

const DEFAULT_GRADIENT: [string, string] = ['hsl(200,70%,55%)', 'hsl(200,70%,35%)'];

const CATEGORY_ORDER = ['stocks', 'cash', 'real_estate', 'commodity'];

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  stocks:      { label: 'Hisseler',    color: 'hsl(196,70%,42%)' },
  cash:        { label: 'Nakit',       color: 'hsl(142,60%,36%)' },
  real_estate: { label: 'Gayrimenkul', color: 'hsl(38,85%,48%)'  },
  commodity:   { label: 'Emtia',       color: 'hsl(270,55%,58%)' },
};

const PIE_START = 90;
const PIE_PADDING = 3;
const OUTER_INNER_R = 119;
const OUTER_OUTER_R = 126;

const RANGE_OPTIONS: { label: string; value: SnapshotRange }[] = [
  { label: '1A', value: '1M' },
  { label: '3A', value: '3M' },
  { label: '6A', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '3Y', value: '3Y' },
];

export interface ChartEntry {
  key: string;
  name: string;
  value: number;
  colors: [string, string];
  pct: number;
  category?: string;
  assetType?: string;
  nativeAmount: number;
  nativeCurrency: NativeCurrency;
}

function formatAmount(amount: number, currency: NativeCurrency): string {
  if (currency === 'TRY') return '₺' + amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  if (currency === 'EUR') return '€' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getDisplayValue(item: ChartEntry, displayMode: DisplayMode, usdTryRate: number | null): string {
  if (displayMode === 'TRY' && usdTryRate)
    return '₺' + (item.value * usdTryRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  if (displayMode === 'USD')
    return '$' + item.value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return formatAmount(item.nativeAmount, item.nativeCurrency);
}

// ─── Active shape ────────────────────────────────────────────────────────────
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
        style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }} />
    </g>
  );
};

// ─── Outer category ring ──────────────────────────────────────────────────────
function OuterCategoryRing({ width, height, sortedData }: { width?: number; height?: number; sortedData: ChartEntry[] }) {
  if (!width || !height || sortedData.length === 0) return null;
  const cx = width / 2;
  const cy = height / 2;
  const total = sortedData.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const N = sortedData.length;
  const totalDataAngle = 360 - N * PIE_PADDING;
  const groups: { category: string; startA: number; endA: number }[] = [];
  let angle = PIE_START;
  let currentCat: string | null = null;

  for (let i = 0; i < N; i++) {
    const slice = sortedData[i];
    const cat = slice.category || 'other';
    const sliceAngle = (slice.value / total) * totalDataAngle;
    const sliceEnd = angle - sliceAngle;
    if (cat !== currentCat) {
      currentCat = cat;
      groups.push({ category: cat, startA: angle, endA: sliceEnd });
    } else {
      groups[groups.length - 1].endA = sliceEnd;
    }
    angle = sliceEnd;
    if (i < N - 1) angle -= PIE_PADDING;
  }

  if (groups.length <= 1) return null;

  return (
    <g>
      {groups.map(g => {
        const meta = CATEGORY_META[g.category];
        if (!meta) return null;
        const arcSpan = Math.abs(g.startA - g.endA);
        const midA = (g.startA + g.endA) / 2;
        const rad = (midA * Math.PI) / 180;
        const labelR = OUTER_OUTER_R + 18;
        const lx = cx + labelR * Math.cos(rad);
        const ly = cy - labelR * Math.sin(rad);
        const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
        return (
          <g key={g.category}>
            <Sector cx={cx} cy={cy} innerRadius={OUTER_INNER_R} outerRadius={OUTER_OUTER_R}
              startAngle={g.startA} endAngle={g.endA} fill={meta.color} opacity={0.88} />
            {arcSpan >= 22 && (
              <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="central"
                fill={meta.color} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em' }}>
                {meta.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ─── Pie tooltip ──────────────────────────────────────────────────────────────
interface TooltipPayload { name: string; value: number; payload: ChartEntry }

function GlassTooltip({ active, payload, displayMode, usdTryRate }:
  { active?: boolean; payload?: TooltipPayload[]; displayMode: DisplayMode; usdTryRate: number | null }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const color = entry.payload.colors?.[0] ?? '#888';
  return (
    <div className="rounded-lg px-3.5 py-2.5 shadow-xl border border-white/10"
      style={{ background: 'rgba(20,20,30,0.80)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
        <span className="font-semibold text-sm text-white">{entry.name}</span>
      </div>
      <div className="font-mono text-sm text-white/90">
        {getDisplayValue(entry.payload, displayMode, usdTryRate)}
      </div>
      <div className="text-xs text-white/50 mt-0.5">{entry.payload.pct.toFixed(1)}%</div>
    </div>
  );
}

// ─── Serüven (line chart) tooltip ─────────────────────────────────────────────
function LineTooltip({ active, payload, label, useTry }:
  { active?: boolean; payload?: any[]; label?: string; useTry: boolean }) {
  if (!active || !payload?.length) return null;
  const val: number = payload[0]?.value ?? 0;
  const formatted = useTry
    ? '₺' + val.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
    : '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return (
    <div className="rounded-lg px-3 py-2 shadow-xl border border-white/10"
      style={{ background: 'rgba(20,20,30,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="text-xs text-white/50 mb-0.5">{label}</div>
      <div className="font-mono text-sm font-semibold text-white">{formatted}</div>
    </div>
  );
}

// ─── Grouped legend ───────────────────────────────────────────────────────────
function CustomLegend({ data, displayMode, usdTryRate }:
  { data: ChartEntry[]; displayMode: DisplayMode; usdTryRate: number | null }) {
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, meta: CATEGORY_META[cat], items: data.filter(d => d.category === cat) }))
    .filter(g => g.items.length > 0);
  const ungrouped = data.filter(d => !CATEGORY_ORDER.includes(d.category || ''));

  return (
    <div className="mt-4 px-2 space-y-3">
      {grouped.map(({ cat, meta, items }) => (
        <div key={cat}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: meta?.color }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta?.color }}>
              {meta?.label}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 pl-3.5 border-l-2"
            style={{ borderColor: (meta?.color ?? '#888') + '55' }}>
            {items.map(item => (
              <div key={item.key} className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-foreground truncate">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {getDisplayValue(item, displayMode, usdTryRate)} · {item.pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
          {ungrouped.map(item => (
            <div key={item.key} className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-foreground truncate">{item.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {getDisplayValue(item, displayMode, usdTryRate)} · {item.pct.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Serüven line chart ───────────────────────────────────────────────────────
function SeruvenChart({
  range, setRange, displayMode, usdTryRate, todayUsd, todayTry,
}: {
  range: SnapshotRange;
  setRange: (r: SnapshotRange) => void;
  displayMode: DisplayMode;
  usdTryRate: number | null;
  todayUsd: number;
  todayTry: number | null;
}) {
  const { snapshots, isLoading } = usePortfolioValueSnapshots(range);
  const useTry = displayMode === 'TRY';

  // Merge snapshots with today's live value
  const chartPoints = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const pts = snapshots.map(s => ({
      date: s.snapshot_date,
      label: format(parseISO(s.snapshot_date), 'd MMM', { locale: tr }),
      value: useTry ? (s.value_try ?? s.value_usd * (usdTryRate ?? 1)) : s.value_usd,
    }));
    // Ensure today's current value is present (as last point)
    const todayVal = useTry ? (todayTry ?? (usdTryRate ? todayUsd * usdTryRate : 0)) : todayUsd;
    if (pts.length === 0 || pts[pts.length - 1].date !== todayStr) {
      pts.push({ date: todayStr, label: 'Bugün', value: todayVal });
    } else {
      pts[pts.length - 1].value = todayVal;
      pts[pts.length - 1].label = 'Bugün';
    }
    return pts;
  }, [snapshots, useTry, usdTryRate, todayUsd, todayTry]);

  const minVal = Math.min(...chartPoints.map(p => p.value));
  const maxVal = Math.max(...chartPoints.map(p => p.value));
  const padding = (maxVal - minVal) * 0.15 || maxVal * 0.1 || 100;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;

  const formatY = (v: number) =>
    useTry ? '₺' + (v / 1000).toFixed(0) + 'K' : '$' + (v / 1000).toFixed(1) + 'K';

  const gradId = 'seruven-grad';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[280px] text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Yükleniyor...</span>
      </div>
    );
  }

  if (chartPoints.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground px-6 text-center">
        <TrendingUp className="w-10 h-10 mb-3 opacity-25" />
        <p className="text-sm font-medium">Henüz yeterli veri yok</p>
        <p className="text-xs mt-1 opacity-70">
          Portföyünüzü ziyaret ettikçe her gün otomatik kayıt alınır.<br />
          Birkaç gün içinde grafiğiniz oluşmaya başlayacak.
        </p>
      </div>
    );
  }

  // Tick reduction for readability
  const tickInterval = Math.max(1, Math.floor(chartPoints.length / 6));

  return (
    <div>
      {/* Time range selector */}
      <div className="flex gap-1 mb-3">
        {RANGE_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setRange(opt.value)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
              range === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
            )}>
            {opt.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartPoints} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={formatY}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip content={(props: any) => <LineTooltip {...props} useTry={useTry} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AssetsChartProps {
  /** Rapor filtresine göre dahil edilecek portföy id'leri. undefined → tüm kullanıcı */
  portfolioIds?: string[];
  /** Günlük snapshot yazarken kullanılacak varsayılan portföy. undefined ise kaydetme atlanır */
  snapshotPortfolioId?: string;
}

// ─── Main component ────────────────────────────────────────────────────────────
export function AssetsChart({ portfolioIds, snapshotPortfolioId }: AssetsChartProps = {}) {
  const { assets, isLoading: assetsLoading } = useUserAssets(portfolioIds);
  const { availableCash } = usePortfolioCash(portfolioIds);
  const { getSeriesData, fetchSeries, isLoading: isSeriesLoading } = useMarketSeries();
  const { trades, isLoading: tradesLoading } = useTrades();
  const { getStockBySymbol } = useMarketData();

  const filteredTrades = useMemo(() => {
    if (!portfolioIds) return trades;
    const set = new Set(portfolioIds);
    return trades.filter(t => set.has(t.portfolio_id));
  }, [trades, portfolioIds]);

  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('native');
  const [seruvenMode, setSeruvenMode] = useState(false);
  const [snapshotRange, setSnapshotRange] = useState<SnapshotRange>('1M');

  const cardRef = useRef<HTMLDivElement>(null);
  // Use a ref to track if we've already saved today's snapshot this session
  const snapshotSavedRef = useRef(false);
  const { saveSnapshot } = usePortfolioValueSnapshots(snapshotRange, portfolioIds);

  useEffect(() => { fetchSeries('usd'); }, [fetchSeries]);

  const usdTryRate = useMemo(() => {
    const d = getSeriesData('usd');
    return d?.points?.length ? d.points[d.points.length - 1].value : null;
  }, [getSeriesData]);

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

  const chartData = useMemo(() => {
    const slices: Omit<ChartEntry, 'pct'>[] = [];

    if (openPositionsUsd > 0) {
      slices.push({ key: 'hisselerim', name: 'Hisselerim', value: openPositionsUsd,
        colors: ASSET_COLORS['hisselerim'], category: 'stocks', assetType: 'hisselerim',
        nativeAmount: openPositionsUsd, nativeCurrency: 'USD' });
    }

    if (availableCash > 0 && usdTryRate) {
      slices.push({ key: 'tl_cash', name: 'TL Nakit', value: availableCash / usdTryRate,
        colors: ASSET_COLORS['tl_cash'], category: 'cash', assetType: 'tl_cash',
        nativeAmount: availableCash, nativeCurrency: 'TRY' });
    }

    for (const asset of assets) {
      if (asset.amount_usd <= 0) continue;
      const meta = asset.metadata as { native_currency?: string; native_amount?: number } | null;
      let valueUsd: number, nativeAmount: number, nativeCurrency: NativeCurrency;

      if (asset.asset_type === 'usd') {
        valueUsd = asset.amount_usd; nativeAmount = asset.amount_usd; nativeCurrency = 'USD';
      } else if (asset.asset_type === 'eur') {
        valueUsd = asset.amount_usd; nativeAmount = asset.quantity; nativeCurrency = 'EUR';
      } else if (asset.category === 'real_estate') {
        if (meta?.native_currency === 'TRY' && meta.native_amount != null) {
          valueUsd = asset.amount_usd; nativeAmount = meta.native_amount; nativeCurrency = 'TRY';
        } else if (meta?.native_currency === 'USD' && meta.native_amount != null) {
          valueUsd = asset.amount_usd; nativeAmount = meta.native_amount; nativeCurrency = 'USD';
        } else {
          valueUsd = asset.amount_usd; nativeAmount = asset.amount_usd; nativeCurrency = 'USD';
        }
      } else {
        valueUsd = asset.amount_usd; nativeAmount = asset.amount_usd; nativeCurrency = 'USD';
      }

      const key = asset.category === 'real_estate' && asset.title ? `re_${asset.id}` : asset.asset_type;
      const label = ASSET_LABELS[asset.asset_type] || asset.asset_type;
      const existing = slices.find(s => s.key === key);
      if (existing) { existing.value += valueUsd; existing.nativeAmount += nativeAmount; }
      else {
        slices.push({ key, name: label, value: valueUsd,
          colors: ASSET_COLORS[asset.asset_type] || DEFAULT_GRADIENT,
          category: asset.category, assetType: asset.asset_type, nativeAmount, nativeCurrency });
      }
    }

    const total = slices.reduce((s, d) => s + d.value, 0);
    return slices.map(s => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }));
  }, [assets, availableCash, usdTryRate, openPositionsUsd]);

  const sortedChartData = useMemo(() =>
    [...chartData].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category || '');
      const bi = CATEGORY_ORDER.indexOf(b.category || '');
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }), [chartData]);

  const isLoading = assetsLoading || tradesLoading || isSeriesLoading('usd');
  const totalUsd = sortedChartData.reduce((s, d) => s + d.value, 0);
  const totalTry = usdTryRate ? totalUsd * usdTryRate : null;

  // Auto-save today's snapshot once per session when data is ready
  useEffect(() => {
    if (isLoading || snapshotSavedRef.current || totalUsd <= 0) return;
    if (!snapshotPortfolioId) return; // Filtre bazlı görünümde otomatik yazma yapma
    snapshotSavedRef.current = true;
    saveSnapshot.mutate({
      portfolioId: snapshotPortfolioId,
      valueUsd: totalUsd,
      valueTry: totalTry ?? undefined,
    });
  }, [isLoading, totalUsd, totalTry, snapshotPortfolioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const centerText = useMemo(() => {
    if (displayMode === 'TRY' && usdTryRate)
      return '₺' + (totalUsd * usdTryRate).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    return '$' + totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }, [displayMode, totalUsd, usdTryRate]);

  const handleToggle = (mode: DisplayMode) => {
    setDisplayMode(prev => (prev === mode && mode !== 'native') ? 'native' : mode);
  };

  const onPieEnter = useCallback((_: any, index: number) => setActiveIndex(index), []);
  const onPieLeave = useCallback(() => setActiveIndex(undefined), []);

  return (
    <div ref={cardRef} className="rounded-xl bg-card border border-border p-4 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <PieIcon className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Varlıklarım</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Currency toggles */}
          <div className="flex gap-1">
            {(['native', 'TRY', 'USD'] as DisplayMode[]).map(mode => (
              <button key={mode} onClick={() => handleToggle(mode)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
                  displayMode === mode
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                )}>
                {mode === 'native' ? 'Ham' : mode === 'TRY' ? '₺ TL' : '$ USD'}
              </button>
            ))}
          </div>

          {/* Serüven button */}
          <button
            onClick={() => setSeruvenMode(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border transition-all',
              seruvenMode
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            )}>
            <TrendingUp className="w-3.5 h-3.5" />
            Serüven
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && sortedChartData.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <PieIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Henüz varlık kaydı yok.</p>
          <p className="text-xs mt-1">Anasayfadan "Portföy Ekle" ile varlık ekleyin.</p>
        </div>
      )}

      {/* Charts */}
      {!isLoading && sortedChartData.length > 0 && (
        <>
          {/* ── Serüven mode: area chart ── */}
          {seruvenMode && (
            <SeruvenChart
              range={snapshotRange}
              setRange={setSnapshotRange}
              displayMode={displayMode}
              usdTryRate={usdTryRate}
              todayUsd={totalUsd}
              todayTry={totalTry}
            />
          )}

          {/* ── Normal mode: donut pie ── */}
          {!seruvenMode && (
            <>
              <ResponsiveContainer width="100%" height={310}>
                <PieChart>
                  <defs>
                    {sortedChartData.map((entry, i) => (
                      <radialGradient key={entry.key} id={`grad-${i}`} cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor={entry.colors[0]} stopOpacity={1} />
                        <stop offset="100%" stopColor={entry.colors[1]} stopOpacity={1} />
                      </radialGradient>
                    ))}
                    <filter id="donut-glow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <Pie data={sortedChartData} cx="50%" cy="50%"
                    innerRadius={70} outerRadius={115}
                    paddingAngle={PIE_PADDING} dataKey="value" nameKey="name"
                    startAngle={PIE_START} endAngle={PIE_START - 360}
                    isAnimationActive animationBegin={0} animationDuration={700} animationEasing="ease-out"
                    activeIndex={activeIndex} activeShape={renderActiveShape}
                    onMouseEnter={onPieEnter} onMouseLeave={onPieLeave}
                    style={{ filter: 'url(#donut-glow)' }}>
                    {sortedChartData.map((entry, i) => (
                      <Cell key={entry.key} fill={`url(#grad-${i})`}
                        stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Customized component={(props: any) => (
                    <OuterCategoryRing width={props.width} height={props.height} sortedData={sortedChartData} />
                  )} />
                  <Tooltip content={(props: any) => (
                    <GlassTooltip {...props} displayMode={displayMode} usdTryRate={usdTryRate} />
                  )} />
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central"
                    fill="hsl(var(--foreground))" style={{ fontSize: 18, fontWeight: 700 }}>
                    {centerText}
                  </text>
                  <text x="50%" y="55%" textAnchor="middle" dominantBaseline="central"
                    fill="hsl(var(--muted-foreground))" style={{ fontSize: 11 }}>
                    Toplam Varlık
                  </text>
                </PieChart>
              </ResponsiveContainer>
              <CustomLegend data={sortedChartData} displayMode={displayMode} usdTryRate={usdTryRate} />
            </>
          )}
        </>
      )}
      <div className="flex justify-center pt-3 pb-1">
        <ShareChartButton targetRef={cardRef} filename="varliklarim" />
      </div>
    </div>
  );
}
