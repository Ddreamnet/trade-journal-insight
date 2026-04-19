import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { startOfDay, subYears } from 'date-fns';

import { Trade } from '@/types/trade';
import {
  usePortfolioValueData,
  PortfolioCurrency,
  PortfolioValuePoint,
} from '@/hooks/usePortfolioValueData';
import {
  PartialCloseRecord,
  calculateT0FromTrades,
} from '@/hooks/useEquityCurveData';
import { useStockPriceSeries } from '@/hooks/useStockPriceSeries';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';

interface CashFlowInput {
  flow_type: string;
  amount: number;
  created_at: string;
}

interface PortfolioValueChartProps {
  closedTrades: Trade[];
  allTrades: Trade[];
  cashFlows: CashFlowInput[];
  partialCloses: PartialCloseRecord[];
  height?: number;
}

/** Compact single-char labels so the 5-option pill never overflows on mobile. */
const CURRENCY_OPTIONS: { value: PortfolioCurrency; label: string }[] = [
  { value: 'TL', label: '₺' },
  { value: 'USD', label: '$' },
  { value: 'EUR', label: '€' },
  { value: 'gold', label: 'Au' },
  { value: 'silver', label: 'Ag' },
];

/**
 * PortfolioValueChart — bare area chart with scrub readout.
 *
 * Design notes:
 *   - Uses an `AreaChart` with a vertical gradient fill so the line feels
 *     anchored to a volume, not floating in space.
 *   - Scrub readout at the top of the chart body shows the exact date and
 *     value the user is pointing at — same pattern as the equity curve.
 *   - Currency switcher rendered as SegmentedControl with single-char
 *     symbols so it fits on narrow phones.
 */
export function PortfolioValueChart({
  closedTrades,
  allTrades,
  cashFlows,
  partialCloses,
  height = 320,
}: PortfolioValueChartProps) {
  const [selectedCurrency, setSelectedCurrency] =
    useState<PortfolioCurrency>('TL');
  const [scrub, setScrub] = useState<PortfolioValuePoint | null>(null);

  const { priceStartDate, priceEndDate } = useMemo(() => {
    const today = startOfDay(new Date());
    const t0 = calculateT0FromTrades(
      allTrades.length > 0 ? allTrades : closedTrades
    );
    const threeYearsAgo = subYears(today, 3);
    const start = t0 && t0 > threeYearsAgo ? t0 : threeYearsAgo;
    return { priceStartDate: start, priceEndDate: today };
  }, [allTrades, closedTrades]);

  const { priceMap: stockPriceMap, missingSymbols } = useStockPriceSeries(
    allTrades,
    priceStartDate,
    priceEndDate
  );

  const { data, t0, currencyFallback } = usePortfolioValueData(
    closedTrades,
    allTrades,
    cashFlows,
    partialCloses,
    selectedCurrency,
    stockPriceMap,
    missingSymbols
  );

  if (!t0 || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center px-4"
        style={{ height }}
      >
        <p className="text-label text-muted-foreground text-center">
          Henüz işlem bulunmuyor.
        </p>
      </div>
    );
  }

  const latestPoint = data[data.length - 1];
  const firstPoint = data[0];
  const readoutPoint = scrub ?? latestPoint;
  const delta =
    readoutPoint && firstPoint
      ? readoutPoint.value - firstPoint.value
      : null;
  const deltaPct =
    delta !== null && firstPoint && firstPoint.value > 0
      ? (delta / firstPoint.value) * 100
      : null;

  const currencySymbol =
    selectedCurrency === 'TL'
      ? '₺'
      : selectedCurrency === 'USD'
        ? '$'
        : selectedCurrency === 'EUR'
          ? '€'
          : 'gr';

  return (
    <div className="w-full">
      <div className="px-4 md:px-3 mb-3">
        <SegmentedControl
          value={selectedCurrency}
          onChange={(v) => {
            setSelectedCurrency(v as PortfolioCurrency);
            setScrub(null);
          }}
          options={CURRENCY_OPTIONS}
          size="sm"
          stretch
        />
      </div>

      {/* Scrub readout */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-3 pb-2">
        <div className="min-w-0">
          <div className="text-caption text-muted-foreground">
            {scrub ? scrub.date : 'Güncel değer'}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="num-lg text-foreground">
              {currencySymbol}
              {readoutPoint.value.toLocaleString('tr-TR', {
                minimumFractionDigits: 0,
                maximumFractionDigits:
                  selectedCurrency === 'gold' || selectedCurrency === 'silver'
                    ? 2
                    : 0,
              })}
            </span>
            {deltaPct !== null && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-label font-mono font-semibold',
                  deltaPct >= 0 ? 'text-profit' : 'text-loss'
                )}
              >
                {deltaPct >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {deltaPct >= 0 ? '+' : ''}
                {deltaPct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        {selectedCurrency !== 'TL' && (
          <div className="text-right shrink-0">
            <div className="text-caption text-muted-foreground">TL karşılığı</div>
            <div className="num-sm text-foreground mt-0.5">
              ₺
              {readoutPoint.valueTL.toLocaleString('tr-TR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
        )}
      </div>

      {currencyFallback && selectedCurrency !== 'TL' && (
        <div className="flex items-center gap-2 text-caption text-warning px-4 md:px-3 mb-2">
          <AlertTriangle className="w-3 h-3" />
          Kur verisi alınamadı, TL bazında gösteriliyor.
        </div>
      )}
      {missingSymbols.length > 0 && (
        <div className="flex items-center gap-2 text-caption text-warning px-4 md:px-3 mb-2">
          <AlertTriangle className="w-3 h-3" />
          {missingSymbols.join(', ')} için fiyat verisi alınamadı.
        </div>
      )}

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onMouseMove={(state) => {
              if (state?.activePayload?.[0]?.payload) {
                setScrub(state.activePayload[0].payload);
              }
            }}
            onMouseLeave={() => setScrub(null)}
          >
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.32}
                />
                <stop
                  offset="60%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.08}
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="hsl(var(--border-subtle))"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
              }}
              minTickGap={28}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={40}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontWeight: 500,
              }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)
              }
            />
            <Tooltip
              content={<InlineTooltip selectedCurrency={selectedCurrency} />}
              cursor={{
                stroke: 'hsl(var(--primary))',
                strokeWidth: 1,
                strokeDasharray: '2 4',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="Portföy"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#valueFill)"
              fillOpacity={1}
              dot={<CustomDot />}
              activeDot={{
                r: 5,
                fill: 'hsl(var(--primary))',
                stroke: 'hsl(var(--background))',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: PortfolioValuePoint;
}) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;

  if (payload.cashFlowEvent) {
    const isDeposit = payload.cashFlowEvent.type === 'deposit';
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill={isDeposit ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    );
  }
  if (payload.tradeEvent) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={2.5}
        fill="hsl(var(--muted-foreground))"
        stroke="hsl(var(--background))"
        strokeWidth={1}
      />
    );
  }
  return null;
}

function InlineTooltip({
  active,
  payload,
  selectedCurrency,
}: {
  active?: boolean;
  payload?: Array<{ payload: PortfolioValuePoint }>;
  selectedCurrency: PortfolioCurrency;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const currencySymbol =
    selectedCurrency === 'TL'
      ? '₺'
      : selectedCurrency === 'USD'
        ? '$'
        : selectedCurrency === 'EUR'
          ? '€'
          : 'gr';

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/95 backdrop-blur-md px-3 py-2.5 shadow-lg min-w-[160px]">
      <div className="text-caption text-muted-foreground">{point.date}</div>
      <div className="num-lg text-foreground mt-0.5">
        {currencySymbol}
        {point.value.toLocaleString('tr-TR', {
          minimumFractionDigits: 0,
          maximumFractionDigits:
            selectedCurrency === 'gold' || selectedCurrency === 'silver' ? 2 : 0,
        })}
      </div>
      {selectedCurrency !== 'TL' && (
        <div className="text-caption text-muted-foreground mt-0.5">
          ₺
          {point.valueTL.toLocaleString('tr-TR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </div>
      )}
      {point.cashFlowEvent && (
        <div
          className={cn(
            'text-label mt-1.5',
            point.cashFlowEvent.type === 'deposit' ? 'text-profit' : 'text-loss'
          )}
        >
          {point.cashFlowEvent.type === 'deposit' ? 'Para Girişi' : 'Para Çıkışı'}:{' '}
          {point.cashFlowEvent.type === 'deposit' ? '+' : '−'}₺
          {point.cashFlowEvent.amount.toLocaleString('tr-TR')}
        </div>
      )}
      {point.tradeEvent && (
        <div className="text-caption text-muted-foreground mt-1">
          {point.tradeEvent.symbol}{' '}
          {point.tradeEvent.type === 'buy' ? 'Alım' : 'Satım'}
        </div>
      )}
    </div>
  );
}
