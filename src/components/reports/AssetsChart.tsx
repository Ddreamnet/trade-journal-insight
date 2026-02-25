import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector
} from 'recharts';
import { useUserAssets } from '@/hooks/useUserAssets';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { Loader2, PieChart as PieIcon } from 'lucide-react';

const ASSET_LABELS: Record<string, string> = {
  tl_cash: 'TL Nakit',
  usd: 'USD',
  eur: 'EUR',
  konut: 'Konut',
  isyeri: 'İşyeri',
  arsa: 'Arsa',
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  altin: 'Altın',
  gumus: 'Gümüş',
};

const ASSET_COLORS: Record<string, [string, string]> = {
  tl_cash:   ['hsl(142,76%,36%)', 'hsl(142,76%,26%)'],
  usd:       ['hsl(152,60%,50%)', 'hsl(152,60%,35%)'],
  eur:       ['hsl(217,91%,65%)', 'hsl(217,91%,45%)'],
  konut:     ['hsl(38,92%,55%)',  'hsl(38,92%,40%)'],
  isyeri:    ['hsl(0,84%,65%)',   'hsl(0,84%,45%)'],
  arsa:      ['hsl(270,72%,65%)', 'hsl(270,72%,45%)'],
  bitcoin:   ['hsl(24,94%,58%)',  'hsl(24,94%,40%)'],
  ethereum:  ['hsl(239,84%,72%)', 'hsl(239,84%,50%)'],
  altin:     ['hsl(48,96%,58%)',  'hsl(48,96%,40%)'],
  gumus:     ['hsl(215,20%,70%)', 'hsl(215,20%,50%)'],
};

const DEFAULT_GRADIENT: [string, string] = ['hsl(200,70%,55%)', 'hsl(200,70%,35%)'];

interface ChartEntry {
  key: string;
  name: string;
  value: number;
  colors: [string, string];
  pct: number;
}

// Active shape for hover
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 3}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15))' }}
      />
    </g>
  );
};

// Center label
function CenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-lg font-bold" style={{ fontSize: 18, fontWeight: 700 }}>
        ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="central"
        className="fill-muted-foreground" style={{ fontSize: 11 }}>
        Toplam Varlık
      </text>
    </g>
  );
}

// Glassmorphism tooltip
interface TooltipPayload {
  name: string;
  value: number;
  payload: ChartEntry;
}

function GlassTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const color = entry.payload.colors[0];
  return (
    <div className="rounded-lg px-3.5 py-2.5 shadow-xl border border-white/10"
      style={{ background: 'rgba(20,20,30,0.75)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
        <span className="font-semibold text-sm text-white">{entry.name}</span>
      </div>
      <div className="font-mono text-sm text-white/90">
        ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="text-xs text-white/50 mt-0.5">{entry.payload.pct.toFixed(1)}%</div>
    </div>
  );
}

// Custom legend
function CustomLegend({ data }: { data: ChartEntry[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5 mt-4 px-2">
      {data.map((item) => (
        <div key={item.key} className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }} />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-foreground truncate">{item.name}</div>
            <div className="text-[10px] text-muted-foreground font-mono">
              ${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })} · {item.pct.toFixed(1)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AssetsChart() {
  const { assets, isLoading: assetsLoading } = useUserAssets();
  const { availableCash } = usePortfolioCash();
  const { getSeriesData, fetchSeries, isLoading: isSeriesLoading } = useMarketSeries();
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchSeries('usd');
  }, [fetchSeries]);

  const usdTryRate = useMemo(() => {
    const usdData = getSeriesData('usd');
    if (usdData?.points?.length) {
      return usdData.points[usdData.points.length - 1].value;
    }
    return null;
  }, [getSeriesData]);

  const chartData = useMemo(() => {
    const slices: { key: string; name: string; value: number; colors: [string, string] }[] = [];

    // TL cash → convert to USD
    if (availableCash > 0 && usdTryRate) {
      slices.push({
        key: 'tl_cash',
        name: 'TL Nakit',
        value: availableCash / usdTryRate,
        colors: ASSET_COLORS['tl_cash'],
      });
    }

    // User assets
    for (const asset of assets) {
      if (asset.amount_usd <= 0) continue;

      const key = asset.category === 'real_estate' && asset.title
        ? `re_${asset.id}`
        : asset.asset_type;

      const label = ASSET_LABELS[asset.asset_type] || asset.asset_type;

      const existing = slices.find(s => s.key === key);
      if (existing) {
        existing.value += asset.amount_usd;
      } else {
        slices.push({
          key,
          name: label,
          value: asset.amount_usd,
          colors: ASSET_COLORS[asset.asset_type] || DEFAULT_GRADIENT,
        });
      }
    }

    const total = slices.reduce((s, d) => s + d.value, 0);
    return slices.map(s => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }));
  }, [assets, availableCash, usdTryRate]);

  const isLoading = assetsLoading || isSeriesLoading('usd');
  const totalUsd = chartData.reduce((s, d) => s + d.value, 0);

  const onPieEnter = useCallback((_: any, index: number) => setActiveIndex(index), []);
  const onPieLeave = useCallback(() => setActiveIndex(undefined), []);

  return (
    <div className="rounded-xl bg-card border border-border p-4 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Varlıklarım</h2>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Yükleniyor...</span>
        </div>
      )}

      {!isLoading && chartData.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <PieIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Henüz varlık kaydı yok.</p>
          <p className="text-xs mt-1">Anasayfadan "Portföy Ekle" ile varlık ekleyin.</p>
        </div>
      )}

      {!isLoading && chartData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <defs>
                {chartData.map((entry, i) => (
                  <radialGradient key={entry.key} id={`grad-${i}`} cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor={entry.colors[0]} stopOpacity={1} />
                    <stop offset="100%" stopColor={entry.colors[1]} stopOpacity={1} />
                  </radialGradient>
                ))}
                <filter id="donut-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={115}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                isAnimationActive
                animationBegin={0}
                animationDuration={700}
                animationEasing="ease-out"
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                style={{ filter: 'url(#donut-glow)' }}
              >
                {chartData.map((entry, i) => (
                  <Cell
                    key={entry.key}
                    fill={`url(#grad-${i})`}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<GlassTooltip />} />
              {/* Center label */}
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central"
                fill="hsl(var(--foreground))" style={{ fontSize: 18, fontWeight: 700 }}>
                ${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </text>
              <text x="50%" y="55%" textAnchor="middle" dominantBaseline="central"
                fill="hsl(var(--muted-foreground))" style={{ fontSize: 11 }}>
                Toplam Varlık
              </text>
            </PieChart>
          </ResponsiveContainer>
          <CustomLegend data={chartData} />
        </>
      )}
    </div>
  );
}
