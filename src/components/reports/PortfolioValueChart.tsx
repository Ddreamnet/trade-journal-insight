import { useState, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Trade } from '@/types/trade';
import {
  usePortfolioValueData,
  PortfolioCurrency,
  PortfolioValuePoint,
} from '@/hooks/usePortfolioValueData';
import { PartialCloseRecord, calculateT0FromTrades } from '@/hooks/useEquityCurveData';
import { useStockPriceSeries } from '@/hooks/useStockPriceSeries';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { ShareChartButton } from '@/components/ui/ShareChartButton';
import { startOfDay, subYears } from 'date-fns';

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
}

const CURRENCY_OPTIONS: { id: PortfolioCurrency; label: string }[] = [
  { id: 'TL', label: '₺ TL' },
  { id: 'USD', label: '$ USD' },
  { id: 'EUR', label: '€ EUR' },
  { id: 'gold', label: '🥇 Altın' },
  { id: 'silver', label: '🥈 Gümüş' },
];

// Custom dot renderer for markers
function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: PortfolioValuePoint;
}) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;

  // Cash flow event — larger dot
  if (payload.cashFlowEvent) {
    const isDeposit = payload.cashFlowEvent.type === 'deposit';
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={isDeposit ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    );
  }

  // Trade entry event — small marker
  if (payload.tradeEvent) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill="hsl(var(--muted-foreground))"
        stroke="hsl(var(--foreground))"
        strokeWidth={1}
      />
    );
  }

  return null;
}

// Custom Tooltip
function CustomTooltip({
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
          : selectedCurrency === 'silver'
            ? 'gr'
            : 'gr';

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <div className="font-medium text-foreground mb-1">{point.date}</div>
      <div className="font-mono font-semibold text-primary">
        {currencySymbol}
        {point.value.toLocaleString('tr-TR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: (selectedCurrency === 'gold' || selectedCurrency === 'silver') ? 2 : 0,
        })}
      </div>
      {selectedCurrency !== 'TL' && (
        <div className="text-xs text-muted-foreground mt-1">
          ₺{point.valueTL.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
      )}
      {point.cashFlowEvent && (
        <div
          className={cn(
            'text-xs mt-1 font-medium',
            point.cashFlowEvent.type === 'deposit' ? 'text-profit' : 'text-loss'
          )}
        >
          {point.cashFlowEvent.type === 'deposit' ? 'Para Girişi' : 'Para Çıkışı'}:{' '}
          {point.cashFlowEvent.type === 'deposit' ? '+' : '-'}₺
          {point.cashFlowEvent.amount.toLocaleString('tr-TR')}
        </div>
      )}
      {point.tradeEvent && (
        <div className="text-xs mt-1 text-muted-foreground">
          {point.tradeEvent.symbol}{' '}
          {point.tradeEvent.type === 'buy' ? 'Alım' : 'Satım'}
        </div>
      )}
    </div>
  );
}

export function PortfolioValueChart({
  closedTrades,
  allTrades,
  cashFlows,
  partialCloses,
}: PortfolioValueChartProps) {
  const [selectedCurrency, setSelectedCurrency] =
    useState<PortfolioCurrency>('TL');
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate date range for stock price fetching (t0 → today, max 3y back)
  const { priceStartDate, priceEndDate } = useMemo(() => {
    const today = startOfDay(new Date());
    const t0 = calculateT0FromTrades(allTrades.length > 0 ? allTrades : closedTrades);
    const threeYearsAgo = subYears(today, 3);
    const start = t0 && t0 > threeYearsAgo ? t0 : threeYearsAgo;
    return { priceStartDate: start, priceEndDate: today };
  }, [allTrades, closedTrades]);

  // Fetch stock price series for symbols with open positions
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
      <div className="rounded-xl bg-card border border-border p-4 mb-6">
        <h3 className="text-sm font-medium text-foreground mb-4">
          Portföy Değeri
        </h3>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Henüz kapanmış işlem bulunmuyor
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="rounded-xl bg-card border border-border p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-sm font-medium text-foreground">Portföy Değeri</h3>
        <div className="flex gap-1 p-1 bg-secondary rounded-lg">
          {CURRENCY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedCurrency(opt.id)}
              className={cn(
                'px-2 py-1 rounded-md text-xs font-medium transition-all',
                selectedCurrency === opt.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {currencyFallback && selectedCurrency !== 'TL' && (
        <div className="flex items-center gap-2 text-xs text-amber-500 mb-3">
          <AlertTriangle className="w-3 h-3" />
          Kur verisi alınamadı, TL bazında gösteriliyor
        </div>
      )}

      {missingSymbols.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-500 mb-3">
          <AlertTriangle className="w-3 h-3" />
          {missingSymbols.join(', ')} için fiyat verisi alınamadı (tahmini hesaplama)
        </div>
      )}

      <div className="w-full h-[300px] sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)
              }
            />
            <Tooltip
              content={<CustomTooltip selectedCurrency={selectedCurrency} />}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Portföy"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center pt-3 pb-1">
        <ShareChartButton targetRef={cardRef} filename="portfoy-degeri" />
      </div>
    </div>
  );
}
