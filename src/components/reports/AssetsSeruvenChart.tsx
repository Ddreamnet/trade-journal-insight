import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

import {
  usePortfolioValueSnapshots,
  SnapshotRange,
} from '@/hooks/usePortfolioValueSnapshots';
import { SegmentedControl } from '@/components/ui/segmented-control';

type DisplayMode = 'native' | 'TRY' | 'USD';

const RANGE_OPTIONS: { label: string; value: SnapshotRange }[] = [
  { label: '1A', value: '1M' },
  { label: '3A', value: '3M' },
  { label: '6A', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '3Y', value: '3Y' },
];

interface SeruvenChartProps {
  range: SnapshotRange;
  setRange: (r: SnapshotRange) => void;
  displayMode: DisplayMode;
  usdTryRate: number | null;
  todayUsd: number;
  todayTry: number | null;
}

interface Point {
  date: string;
  label: string;
  value: number;
}

/**
 * Portfolio value over time. Pulls the user's daily snapshots and tacks on
 * today's live value as the last point. Small, self-contained — lives in
 * its own file so the main AssetsChart file stays focused on the donut.
 */
export function AssetsSeruvenChart({
  range, setRange, displayMode, usdTryRate, todayUsd, todayTry,
}: SeruvenChartProps) {
  const { snapshots, isLoading } = usePortfolioValueSnapshots(range);
  const useTry = displayMode === 'TRY';

  const chartPoints = useMemo<Point[]>(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const pts: Point[] = snapshots.map((s) => ({
      date: s.snapshot_date,
      label: format(parseISO(s.snapshot_date), 'd MMM', { locale: tr }),
      value: useTry
        ? (s.value_try ?? s.value_usd * (usdTryRate ?? 1))
        : s.value_usd,
    }));
    const todayVal = useTry
      ? (todayTry ?? (usdTryRate ? todayUsd * usdTryRate : 0))
      : todayUsd;

    if (pts.length === 0 || pts[pts.length - 1].date !== todayStr) {
      pts.push({ date: todayStr, label: 'Bugün', value: todayVal });
    } else {
      pts[pts.length - 1] = { ...pts[pts.length - 1], label: 'Bugün', value: todayVal };
    }
    return pts;
  }, [snapshots, useTry, usdTryRate, todayUsd, todayTry]);

  // Range selector is ALWAYS visible — earlier versions only rendered it
  // inside the "has data" branch, which meant if a range returned ≤1 points
  // the empty state swallowed the buttons and the user was stuck.
  const rangeSelector = (
    <div className="px-4 md:px-5 pb-3">
      <SegmentedControl
        value={range}
        onChange={(v) => setRange(v as SnapshotRange)}
        options={RANGE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
        size="sm"
        stretch
        aria-label="Zaman aralığı"
      />
    </div>
  );

  if (isLoading) {
    return (
      <>
        {rangeSelector}
        <div className="flex items-center justify-center h-[240px] text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-label">Yükleniyor…</span>
        </div>
      </>
    );
  }

  if (chartPoints.length <= 1) {
    return (
      <>
        {rangeSelector}
        <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground px-6 text-center">
          <TrendingUp className="w-10 h-10 mb-3 opacity-25" />
          <p className="text-body text-foreground">Henüz yeterli veri yok</p>
          <p className="text-label text-muted-foreground mt-1">
            Birkaç gün sonra grafiğiniz oluşmaya başlayacak.
          </p>
        </div>
      </>
    );
  }

  const values = chartPoints.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.15 || maxVal * 0.1 || 100;
  const yDomain: [number, number] = [Math.max(0, minVal - padding), maxVal + padding];

  const formatY = (v: number) =>
    useTry
      ? '₺' + (v / 1000).toFixed(0) + 'K'
      : '$' + (v / 1000).toFixed(1) + 'K';

  const tickInterval = Math.max(1, Math.floor(chartPoints.length / 6));

  return (
    <>
      {rangeSelector}

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartPoints} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="seruven-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.32} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border-subtle))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            domain={yDomain}
            tickFormatter={formatY}
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 10,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip content={<SeruvenTooltip useTry={useTry} />} cursor={{ stroke: 'hsl(var(--primary))', strokeDasharray: '2 4' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#seruven-fill)"
            dot={false}
            activeDot={{
              r: 4,
              fill: 'hsl(var(--primary))',
              stroke: 'hsl(var(--background))',
              strokeWidth: 2,
            }}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}

function SeruvenTooltip({
  active, payload, label, useTry,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null }>;
  label?: string;
  useTry: boolean;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const formatted = useTry
    ? '₺' + val.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
    : '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/95 backdrop-blur-md px-3 py-2.5 shadow-lg">
      <div className="text-caption text-muted-foreground mb-0.5">{label}</div>
      <div className="num-lg text-foreground">{formatted}</div>
    </div>
  );
}
