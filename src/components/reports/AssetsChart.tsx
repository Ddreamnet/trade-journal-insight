import { useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
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

// Semantic-friendly colors using fixed palette
const ASSET_COLORS: Record<string, string> = {
  tl_cash: 'hsl(142 76% 36%)',   // green (primary-like)
  usd: 'hsl(152 60% 45%)',
  eur: 'hsl(217 91% 60%)',
  konut: 'hsl(38 92% 50%)',
  isyeri: 'hsl(0 84% 60%)',
  arsa: 'hsl(270 72% 60%)',
  bitcoin: 'hsl(24 94% 53%)',
  ethereum: 'hsl(239 84% 67%)',
  altin: 'hsl(48 96% 53%)',
  gumus: 'hsl(215 20% 65%)',
};

interface TooltipPayload {
  name: string;
  value: number;
  payload: { pct: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-background-secondary border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <div className="font-semibold text-foreground mb-0.5">{entry.name}</div>
      <div className="text-muted-foreground font-mono">
        ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="text-xs text-muted-foreground">{entry.payload.pct.toFixed(1)}%</div>
    </div>
  );
}

export function AssetsChart() {
  const { assets, isLoading: assetsLoading } = useUserAssets();
  const { availableCash } = usePortfolioCash();
  const { getSeriesData, fetchSeries, isLoading: isSeriesLoading } = useMarketSeries();

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
    const slices: { key: string; name: string; value: number; color: string }[] = [];

    // TL cash → convert to USD
    if (availableCash > 0 && usdTryRate) {
      slices.push({
        key: 'tl_cash',
        name: 'TL Nakit',
        value: availableCash / usdTryRate,
        color: ASSET_COLORS['tl_cash'],
      });
    }

    // User assets — group real estate by title, emtia/cash by type
    for (const asset of assets) {
      if (asset.amount_usd <= 0) continue;

      // For real estate: each record is a unique item with title
      const key = asset.category === 'real_estate' && asset.title
        ? `re_${asset.id}`
        : asset.asset_type;

      const label = ASSET_LABELS[asset.asset_type] || asset.asset_type;

      // Merge same asset_type (e.g. two USD entries)
      const existing = slices.find(s => s.key === key);
      if (existing) {
        existing.value += asset.amount_usd;
      } else {
        slices.push({
          key,
          name: label,
          value: asset.amount_usd,
          color: ASSET_COLORS[asset.asset_type] || 'hsl(200 70% 50%)',
        });
      }
    }

    const total = slices.reduce((s, d) => s + d.value, 0);
    return slices.map(s => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }));
  }, [assets, availableCash, usdTryRate]);

  const isLoading = assetsLoading || isSeriesLoading('usd');
  const totalUsd = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl bg-card border border-border p-4 mt-6">
      <div className="flex items-center gap-2 mb-6">
        <PieIcon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Varlıklarım</h2>
        {totalUsd > 0 && (
          <span className="ml-auto text-sm font-mono text-muted-foreground">
            Toplam: ${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        )}
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
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={75}
              outerRadius={120}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              isAnimationActive
              animationBegin={0}
              animationDuration={700}
              animationEasing="ease-out"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-foreground">{value}</span>
              )}
              iconType="circle"
              iconSize={10}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
