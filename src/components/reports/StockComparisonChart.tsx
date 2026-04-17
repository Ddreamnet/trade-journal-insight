import { useMemo, useState, useRef, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { Search, X, TrendingUp, TrendingDown, GitCompareArrows } from 'lucide-react';
import { TimeRangeSelector } from '@/components/reports/TimeRangeSelector';
import { TimeRange, TIME_RANGES } from '@/types/trade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockLogo } from '@/components/ui/stock-logo';
import { cn } from '@/lib/utils';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { getTimeRangeDates } from '@/hooks/useEquityCurveData';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface SelectedStock {
  symbol: string;
  logoUrl?: string;
}

interface StockBarPoint {
  symbol: string;
  value: number;
  color: string;
}

interface PricePoint {
  date: string;
  value: number;
}

interface StockSeriesResponse {
  [symbol: string]: {
    points: PricePoint[];
    source: string;
  };
}

function calcPctChange(points: PricePoint[], startDate: Date, endDate: Date): number | null {
  if (!points || points.length === 0) return null;

  const startIso = format(startDate, 'yyyy-MM-dd');
  const endIso = format(endDate, 'yyyy-MM-dd');

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  // Carry-forward: find last known price at or before startDate
  let startPrice: number | null = null;
  for (const p of sorted) {
    if (p.date <= startIso) startPrice = p.value;
    else break;
  }
  // If no price before start, use first available point
  if (startPrice === null && sorted.length > 0) startPrice = sorted[0].value;

  // Find last known price at or before endDate
  let endPrice: number | null = null;
  for (const p of sorted) {
    if (p.date <= endIso) endPrice = p.value;
  }

  if (startPrice === null || endPrice === null || startPrice === 0) return null;
  return ((endPrice - startPrice) / startPrice) * 100;
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: StockBarPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm min-w-[100px]">
      <div className="font-mono font-semibold text-foreground mb-1">{d.symbol}</div>
      <div className={cn('font-mono font-bold text-base', d.value >= 0 ? 'text-profit' : 'text-loss')}>
        {d.value >= 0 ? '+' : ''}
        {d.value.toFixed(2)}%
      </div>
    </div>
  );
}

function BarValueLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number;
}) {
  const { x, y, width, height, value } = props;
  if (
    value === undefined ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number'
  )
    return null;

  const isPositive = value >= 0;
  const labelX = x + width / 2;
  const labelY = isPositive ? y - 7 : y + (typeof height === 'number' ? height : 0) + 14;

  return (
    <text
      x={labelX}
      y={labelY}
      fill={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
      fontSize={10}
      fontFamily="JetBrains Mono, monospace"
      fontWeight={700}
      dominantBaseline="middle"
      textAnchor="middle"
    >
      {isPositive ? '+' : ''}
      {value.toFixed(1)}%
    </text>
  );
}

const BAR_COLORS_POSITIVE = [
  'hsl(142 71% 45%)',
  'hsl(152 71% 40%)',
  'hsl(162 71% 38%)',
  'hsl(132 71% 42%)',
  'hsl(172 60% 38%)',
];
const BAR_COLORS_NEGATIVE = [
  'hsl(0 72% 51%)',
  'hsl(10 72% 48%)',
  'hsl(350 72% 48%)',
  'hsl(5 65% 45%)',
  'hsl(15 65% 45%)',
];

export function StockComparisonChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
  const [selectedStocks, setSelectedStocks] = useState<SelectedStock[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const { stocks: marketStocks, isLoading: marketLoading } = useMarketData();

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setSearch('');
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerOpen]);

  // Focus search when picker opens
  useEffect(() => {
    if (pickerOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [pickerOpen]);

  const filteredMarketStocks = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return marketStocks;
    return marketStocks.filter((s) => s.symbol.toLowerCase().includes(q));
  }, [marketStocks, search]);

  const toggleStock = (symbol: string, logoUrl?: string) => {
    setSelectedStocks((prev) => {
      if (prev.some((s) => s.symbol === symbol)) {
        return prev.filter((s) => s.symbol !== symbol);
      }
      return [...prev, { symbol, logoUrl }];
    });
  };

  const removeStock = (symbol: string) => {
    setSelectedStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  };

  // Date range for the query
  const { startDate, endDate } = useMemo(
    () => getTimeRangeDates(timeRange, new Date()),
    [timeRange]
  );

  const symbolsKey = selectedStocks.map((s) => s.symbol).join(',');

  // Fetch historical price series for selected stocks
  const { data: seriesData, isLoading: seriesLoading } = useQuery({
    queryKey: ['stock-comparison-series', symbolsKey, timeRange],
    queryFn: async (): Promise<StockSeriesResponse> => {
      if (!symbolsKey) return {};
      const { data: fnData, error: fnError } = await supabase.functions.invoke('stock-series', {
        body: { symbols: symbolsKey },
      });
      if (fnError) {
        console.error('[StockComparison] series error:', fnError.message);
        return {};
      }
      return fnData as StockSeriesResponse;
    },
    enabled: selectedStocks.length > 0,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Build chart data
  const chartData: StockBarPoint[] = useMemo(() => {
    if (selectedStocks.length === 0) return [];

    return selectedStocks.map((stock, i) => {
      const series = seriesData?.[stock.symbol];
      const pct = series ? calcPctChange(series.points, startDate, endDate) : null;
      const value = pct ?? 0;
      const isPositive = value >= 0;
      const colorArr = isPositive ? BAR_COLORS_POSITIVE : BAR_COLORS_NEGATIVE;
      return {
        symbol: stock.symbol,
        value,
        color: colorArr[i % colorArr.length],
      };
    });
  }, [selectedStocks, seriesData, startDate, endDate]);

  const timeRangeLabel = TIME_RANGES.find((tr) => tr.id === timeRange)?.label || timeRange;
  const chartHeight = isMobile ? 200 : 240;
  const needsScroll = chartData.length > 6;

  return (
    <div className="rounded-xl bg-card border border-border p-4 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Karşılaştırma</h3>
        </div>
        <TimeRangeSelector selectedRange={timeRange} onSelect={setTimeRange} />
      </div>

      {/* Stock picker row */}
      <div className="relative flex flex-wrap items-center gap-2 mb-5" ref={pickerRef}>
        {/* Trigger button */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
          onClick={() => setPickerOpen((o) => !o)}
        >
          <Search className="h-3.5 w-3.5" />
          Hisse Ekle
        </Button>

        {/* Selected chips */}
        {selectedStocks.map((stock) => {
          const ms = marketStocks.find((s) => s.symbol === stock.symbol);
          const pct = ms?.chgPct;
          return (
            <div
              key={stock.symbol}
              className="flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 rounded-lg text-xs font-mono font-semibold bg-secondary border border-border hover:border-primary/40 transition-colors"
            >
              <StockLogo symbol={stock.symbol} logoUrl={stock.logoUrl} size="sm" />
              <span className="text-foreground">{stock.symbol}</span>
              {pct !== undefined && (
                <span className={cn('text-[10px]', pct >= 0 ? 'text-profit' : 'text-loss')}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                </span>
              )}
              <button
                onClick={() => removeStock(stock.symbol)}
                className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Dropdown picker */}
        {pickerOpen && (
          <div className="absolute top-full left-0 z-50 mt-1.5 w-72 bg-background-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Hisse ara... (örn: THYAO)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background border-border"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-60">
              {marketLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : filteredMarketStocks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Hisse bulunamadı</p>
              ) : (
                filteredMarketStocks.map((ms) => {
                  const isSelected = selectedStocks.some((s) => s.symbol === ms.symbol);
                  return (
                    <button
                      key={ms.symbol}
                      onClick={() => toggleStock(ms.symbol, ms.logoUrl)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-secondary',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <StockLogo symbol={ms.symbol} logoUrl={ms.logoUrl} size="sm" />
                        <span className="font-mono font-semibold text-foreground">{ms.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          ₺{ms.last.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            'flex items-center gap-0.5 text-xs font-mono font-semibold',
                            ms.chgPct >= 0 ? 'text-profit' : 'text-loss'
                          )}
                        >
                          {ms.chgPct >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {ms.chgPct >= 0 ? '+' : ''}
                          {ms.chgPct.toFixed(2)}%
                        </span>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {selectedStocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 h-28 text-muted-foreground">
          <GitCompareArrows className="w-8 h-8 opacity-30" />
          <p className="text-sm">Karşılaştırmak için hisse ekleyin</p>
        </div>
      ) : seriesLoading ? (
        <div className="space-y-2 mt-2">
          <Skeleton className="w-full h-[240px]" />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">
            Seçili aralık:{' '}
            <span className="text-foreground font-medium">{timeRangeLabel}</span>
            {' '}— Fiyat değişimi (%)
          </p>
          <div className={cn(needsScroll && 'overflow-x-auto')}>
            <div style={{ minWidth: needsScroll ? chartData.length * 90 : 'auto' }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={chartData} margin={{ top: 28, right: 12, left: -10, bottom: 5 }}>
                  <XAxis
                    dataKey="symbol"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="JetBrains Mono, monospace"
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--border))', opacity: 0.4 }} />
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.5}
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={44}>
                    {chartData.map((entry) => (
                      <Cell key={entry.symbol} fill={entry.color} fillOpacity={0.9} />
                    ))}
                    <LabelList
                      dataKey="value"
                      content={(props: Record<string, unknown>) => (
                        <BarValueLabel
                          x={props.x as number | string | undefined}
                          y={props.y as number | string | undefined}
                          width={props.width as number | string | undefined}
                          height={props.height as number | string | undefined}
                          value={props.value as number | undefined}
                        />
                      )}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend row */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
            {chartData.map((d) => {
              const ms = marketStocks.find((s) => s.symbol === d.symbol);
              return (
                <div
                  key={d.symbol}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border"
                  style={{
                    borderColor: d.color,
                    backgroundColor: `${d.color}18`,
                  }}
                >
                  <span className="font-mono font-semibold text-foreground">{d.symbol}</span>
                  <span className={cn('font-mono font-bold', d.value >= 0 ? 'text-profit' : 'text-loss')}>
                    {d.value >= 0 ? '+' : ''}{d.value.toFixed(2)}%
                  </span>
                  {ms && (
                    <span className="text-muted-foreground">₺{ms.last.toFixed(2)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
