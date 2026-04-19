import { useEffect, useMemo, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Layers, Target, ShieldAlert } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
} from '@/components/ui/bottom-sheet';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatRow, StatRowGroup } from '@/components/ui/stat-row';
import { Trade } from '@/types/trade';
import { EditTradeForm } from './EditTradeForm';
import { TradeUpdateData } from './EditTradeModal';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { calculateInflationImpact, calculatePurchasingPowerChange } from '@/lib/inflationUtils';
import { calculateProfitPct, convertPnL } from '@/lib/tradeMerge';
import { formatPrice, getSymbolCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface ActiveTradeActionDialogProps {
  trade: Trade | null;
  onClose: () => void;
  onSave: (tradeId: string, data: TradeUpdateData) => void;
  onDelete: (tradeId: string) => void;
  isSubmitting?: boolean;
  hasPartialCloses?: boolean;
}

/**
 * ActiveTradeActionDialog — open-position detail + edit bottom sheet.
 *
 * Two tabs (SegmentedControl): "Detaylar" (summary + inflation + merge
 * history) and "Düzenle" (re-uses EditTradeForm). We keep the details
 * rendered during the edit tab so data-fetching doesn't refire on switch.
 */

function formatTL(amount: number): string {
  return (
    '₺' +
    amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatUSD(amount: number): string {
  return (
    '$' +
    amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: tr });
  } catch {
    return iso;
  }
}

function formatMergeDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

type Tab = 'details' | 'edit';

export function ActiveTradeActionDialog({
  trade,
  onClose,
  onSave,
  onDelete,
  isSubmitting = false,
  hasPartialCloses = false,
}: ActiveTradeActionDialogProps) {
  const [tab, setTab] = useState<Tab>('details');
  const { getStockBySymbol } = useMarketData();
  const { getSeriesData, fetchSeries } = useMarketSeries();

  // Reset tab when the dialog closes and re-opens for a new trade
  useEffect(() => {
    if (trade) setTab('details');
  }, [trade?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!trade) return;
    void fetchSeries('inflation_tr');
    void fetchSeries('usd');
  }, [trade, fetchSeries]);

  const inflationData = getSeriesData('inflation_tr');
  const usdData = getSeriesData('usd');
  const usdTryRate = usdData?.points?.length
    ? [...usdData.points].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.value ?? null
    : null;

  const marketStock = trade ? getStockBySymbol(trade.stock_symbol) : null;
  const currentPrice = marketStock?.last ?? null;
  const currency = trade ? getSymbolCurrency(trade.stock_symbol) : 'TRY';

  const unrealizedPnlNative = useMemo(() => {
    if (!trade || currentPrice === null) return null;
    const sign = trade.trade_type === 'buy' ? 1 : -1;
    return sign * (currentPrice - trade.entry_price) * trade.remaining_lot;
  }, [trade, currentPrice]);

  const unrealizedPnlConv = useMemo(() => {
    if (!trade || unrealizedPnlNative === null) return null;
    return convertPnL(unrealizedPnlNative, trade.stock_symbol, usdTryRate);
  }, [trade, unrealizedPnlNative, usdTryRate]);

  const profitPct = useMemo(() => {
    if (!trade || currentPrice === null) return null;
    return calculateProfitPct(trade.trade_type, trade.entry_price, currentPrice);
  }, [trade, currentPrice]);

  const progress = useMemo(() => {
    if (!trade || currentPrice === null) return null;
    const entry = trade.entry_price;
    const target = trade.target_price;
    const stop = trade.stop_price;
    const toTargetRange = Math.abs(target - entry);
    const toStopRange = Math.abs(stop - entry);

    if (trade.trade_type === 'buy') {
      const distTarget =
        currentPrice >= entry && toTargetRange > 0
          ? ((currentPrice - entry) / toTargetRange) * 100
          : 0;
      const distStop =
        currentPrice < entry && toStopRange > 0
          ? ((entry - currentPrice) / toStopRange) * 100
          : 0;
      return {
        towardTargetPct: Math.min(Math.max(distTarget, 0), 100),
        towardStopPct: Math.min(Math.max(distStop, 0), 100),
      };
    }
    const distTarget =
      currentPrice <= entry && toTargetRange > 0
        ? ((entry - currentPrice) / toTargetRange) * 100
        : 0;
    const distStop =
      currentPrice > entry && toStopRange > 0
        ? ((currentPrice - entry) / toStopRange) * 100
        : 0;
    return {
      towardTargetPct: Math.min(Math.max(distTarget, 0), 100),
      towardStopPct: Math.min(Math.max(distStop, 0), 100),
    };
  }, [trade, currentPrice]);

  const daysOpen = useMemo(() => {
    if (!trade) return 0;
    return Math.max(1, differenceInCalendarDays(new Date(), parseISO(trade.created_at)));
  }, [trade]);

  const inflation = useMemo(() => {
    if (!trade) return null;
    const todayIso = new Date().toISOString();
    return calculateInflationImpact(trade.created_at, todayIso, inflationData?.points);
  }, [trade, inflationData]);

  const purchasingPowerChange = useMemo(() => {
    if (!inflation || profitPct === null) return null;
    return calculatePurchasingPowerChange(profitPct, inflation.cumulativePct);
  }, [inflation, profitPct]);

  // ── Additional stats (position values, scenarios, time-adjusted returns)
  // Small read-out extras that help a trader judge the position beyond the
  // simple nominal P&L we already show.
  const extras = useMemo(() => {
    if (!trade) return null;

    const toTl = (nativeAmount: number): number | null =>
      currency === 'TRY'
        ? nativeAmount
        : usdTryRate
          ? nativeAmount * usdTryRate
          : null;

    const sign = trade.trade_type === 'buy' ? 1 : -1;
    const lots = trade.remaining_lot;

    // Position cost (entry) and current market value, both in TL.
    const entryCostTl = toTl(trade.entry_price * lots);
    const currentValueTl =
      currentPrice !== null ? toTl(currentPrice * lots) : null;

    // Scenario: if price hits target or stop, how much TL do we gain/lose?
    const targetPnlNative =
      sign * (trade.target_price - trade.entry_price) * lots;
    const stopPnlNative =
      sign * (trade.stop_price - trade.entry_price) * lots;
    const targetPnlTl = toTl(targetPnlNative);
    const stopPnlTl = toTl(stopPnlNative);

    // Inflation-adjusted real profit in TL — answers "after inflation,
    // what's actually left?". Uses the canonical purchasing-power change
    // percentage applied to the TL entry value.
    const realPnlTl =
      entryCostTl !== null && purchasingPowerChange !== null
        ? (entryCostTl * purchasingPowerChange) / 100
        : null;

    // Time-adjusted performance metrics
    const dailyPct =
      profitPct !== null && daysOpen > 0 ? profitPct / daysOpen : null;
    const annualizedPct =
      profitPct !== null && daysOpen > 0
        ? (Math.pow(1 + profitPct / 100, 365 / daysOpen) - 1) * 100
        : null;

    return {
      entryCostTl,
      currentValueTl,
      targetPnlTl,
      stopPnlTl,
      realPnlTl,
      dailyPct,
      annualizedPct,
    };
  }, [
    trade,
    currency,
    usdTryRate,
    currentPrice,
    purchasingPowerChange,
    profitPct,
    daysOpen,
  ]);

  if (!trade) return null;

  const isUp = profitPct !== null ? profitPct >= 0 : true;

  return (
    <BottomSheet open={!!trade} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheetContent size="lg" className="flex flex-col">
        <BottomSheetHeader>
          <BottomSheetTitle>{trade.stock_symbol}</BottomSheetTitle>
          <BottomSheetDescription>{trade.stock_name}</BottomSheetDescription>
        </BottomSheetHeader>

        <div className="px-5 pb-3 shrink-0">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: 'details', label: 'Detaylar' },
              { value: 'edit', label: 'Düzenle' },
            ]}
            aria-label="Görünüm"
          />
        </div>

        {tab === 'details' ? (
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {/* Summary */}
            <section className="rounded-xl p-4 surface-1 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-label text-muted-foreground inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Açık İşlem Özeti
                </h3>
                <span className="text-caption text-muted-foreground">
                  {daysOpen} gün
                </span>
              </div>

              {profitPct !== null && unrealizedPnlConv ? (
                <div
                  className={cn(
                    'p-3 rounded-lg',
                    isUp ? 'bg-profit-soft' : 'bg-loss-soft'
                  )}
                >
                  <div className={cn('text-caption', isUp ? 'text-profit' : 'text-loss')}>
                    Gerçekleşmemiş K/Z
                  </div>
                  <div
                    className={cn(
                      'num-display mt-1',
                      isUp ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {unrealizedPnlConv.try !== null
                      ? `${unrealizedPnlConv.try >= 0 ? '+' : '−'}${formatTL(Math.abs(unrealizedPnlConv.try))}`
                      : '—'}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={cn('text-label font-mono font-semibold', isUp ? 'text-profit' : 'text-loss')}>
                      {profitPct >= 0 ? '+' : ''}
                      {profitPct.toFixed(2)}%
                    </span>
                    {unrealizedPnlConv.usd !== null && currency === 'TRY' && (
                      <span className="text-caption text-muted-foreground">
                        {unrealizedPnlConv.usd >= 0 ? '+' : '−'}
                        {formatUSD(Math.abs(unrealizedPnlConv.usd))}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border-subtle text-center">
                  <p className="text-label text-muted-foreground">
                    Anlık fiyat alınamadı
                  </p>
                </div>
              )}

              <StatRowGroup className="bg-transparent border-0 px-0">
                <StatRow
                  label="Tür"
                  value={trade.trade_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                  tone={trade.trade_type === 'buy' ? 'profit' : 'loss'}
                  valueType="text"
                  dense
                />
                <StatRow
                  label="Lot (kalan / toplam)"
                  value={`${trade.remaining_lot} / ${trade.lot_quantity}`}
                  dense
                />
                <StatRow
                  label="Giriş fiyatı"
                  value={formatPrice(trade.entry_price, currency)}
                  dense
                />
                <StatRow
                  label="Anlık fiyat"
                  value={currentPrice !== null ? formatPrice(currentPrice, currency) : '—'}
                  dense
                />
                <StatRow
                  label="Açılış"
                  value={formatDate(trade.created_at)}
                  valueType="text"
                  dense
                />
                {extras?.entryCostTl !== null && extras?.entryCostTl !== undefined && (
                  <StatRow
                    label="Giriş tutarı"
                    value={formatTL(extras.entryCostTl)}
                    dense
                  />
                )}
                {extras?.currentValueTl !== null && extras?.currentValueTl !== undefined && (
                  <StatRow
                    label="Güncel değer"
                    value={formatTL(extras.currentValueTl)}
                    tone={isUp ? 'profit' : 'loss'}
                    dense
                  />
                )}
                {extras?.dailyPct !== null && extras?.dailyPct !== undefined && (
                  <StatRow
                    label="Günlük getiri"
                    value={`${extras.dailyPct >= 0 ? '+' : ''}%${extras.dailyPct.toFixed(2)}`}
                    tone={extras.dailyPct >= 0 ? 'profit' : 'loss'}
                    dense
                  />
                )}
                {extras?.annualizedPct !== null && extras?.annualizedPct !== undefined && (
                  <StatRow
                    label="Yıllık eşdeğer"
                    value={`${extras.annualizedPct >= 0 ? '+' : ''}%${extras.annualizedPct.toFixed(1)}`}
                    tone={extras.annualizedPct >= 0 ? 'profit' : 'loss'}
                    sub="Yıllıklandırılmış"
                    dense
                  />
                )}
              </StatRowGroup>
            </section>

            {/* Progress */}
            {progress && (
              <section className="rounded-xl p-4 surface-1 space-y-3">
                <h3 className="text-label text-muted-foreground">
                  Hedef / Stop İlerlemesi
                </h3>
                <ProgressBar
                  label="Hedefe mesafe"
                  value={progress.towardTargetPct}
                  tone="profit"
                  icon={Target}
                />
                <ProgressBar
                  label="Stop'a mesafe"
                  value={progress.towardStopPct}
                  tone="loss"
                  icon={ShieldAlert}
                />
              </section>
            )}

            {/* Scenario analysis — what happens if price hits target or stop */}
            {extras && (extras.targetPnlTl !== null || extras.stopPnlTl !== null) && (
              <section className="rounded-xl p-4 surface-1 space-y-2">
                <h3 className="text-label text-muted-foreground">
                  Senaryo Analizi
                </h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Fiyat hedefe veya stop'a ulaşırsa TL olarak kazanç / kayıp.
                </p>
                <StatRowGroup className="bg-transparent border-0 px-0">
                  {extras.targetPnlTl !== null && (
                    <StatRow
                      label="Hedefe ulaşsa"
                      value={`${extras.targetPnlTl >= 0 ? '+' : '−'}${formatTL(Math.abs(extras.targetPnlTl))}`}
                      tone={extras.targetPnlTl >= 0 ? 'profit' : 'loss'}
                      icon={Target}
                      dense
                    />
                  )}
                  {extras.stopPnlTl !== null && (
                    <StatRow
                      label="Stop olursa"
                      value={`${extras.stopPnlTl >= 0 ? '+' : '−'}${formatTL(Math.abs(extras.stopPnlTl))}`}
                      tone={extras.stopPnlTl >= 0 ? 'profit' : 'loss'}
                      icon={ShieldAlert}
                      dense
                    />
                  )}
                </StatRowGroup>
              </section>
            )}

            {/* Inflation */}
            {inflation && (
              <section className="rounded-xl p-4 surface-1 space-y-2">
                <h3 className="text-label text-muted-foreground">
                  Enflasyon Karşılaştırması
                </h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Son aylık TÜFE %{inflation.monthlyRatePct.toFixed(2)} — günlük
                  %{inflation.dailyRatePct.toFixed(4)} × {inflation.daysHeld} gün.
                </p>

                <StatRowGroup className="bg-transparent border-0 px-0">
                  <StatRow
                    label="Dönem enflasyonu"
                    value={`%${inflation.cumulativePct.toFixed(2)}`}
                    dense
                  />
                  <StatRow
                    label="Anlık getiri"
                    value={profitPct !== null ? `${profitPct >= 0 ? '+' : ''}%${profitPct.toFixed(2)}` : '—'}
                    tone={profitPct !== null && profitPct >= 0 ? 'profit' : 'loss'}
                    dense
                  />
                  {purchasingPowerChange !== null && (
                    <StatRow
                      label="Alım gücü değişimi"
                      value={`${purchasingPowerChange >= 0 ? '+' : ''}%${purchasingPowerChange.toFixed(2)}`}
                      tone={purchasingPowerChange >= 0 ? 'profit' : 'loss'}
                      dense
                    />
                  )}
                  {extras?.realPnlTl !== null && extras?.realPnlTl !== undefined && (
                    <StatRow
                      label="Reel kâr / zarar"
                      value={`${extras.realPnlTl >= 0 ? '+' : '−'}${formatTL(Math.abs(extras.realPnlTl))}`}
                      tone={extras.realPnlTl >= 0 ? 'profit' : 'loss'}
                      sub="Enflasyon sonrası"
                      dense
                    />
                  )}
                </StatRowGroup>
              </section>
            )}

            {/* Merge history */}
            {trade.merge_count > 1 && trade.merge_history && trade.merge_history.length > 0 && (
              <section className="rounded-xl p-4 surface-1 space-y-2">
                <h3 className="text-label text-muted-foreground inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Birleşme Geçmişi ({trade.merge_history.length})
                </h3>

                <div className="space-y-1.5">
                  {trade.merge_history.map((h, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-surface-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-label text-foreground">#{i + 1}</span>
                        <span className="text-caption text-muted-foreground">
                          {formatMergeDate(h.merged_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div>
                          <div className="text-caption text-muted-foreground">Önce</div>
                          <div className="num-sm text-muted-foreground">
                            {h.original_lot} · {formatPrice(h.original_entry, trade.stock_symbol)}
                          </div>
                        </div>
                        <div>
                          <div className="text-caption text-muted-foreground">Eklenen</div>
                          <div className="num-sm text-primary">
                            +{h.added_lot} · {formatPrice(h.added_entry, trade.stock_symbol)}
                          </div>
                        </div>
                        <div>
                          <div className="text-caption text-muted-foreground">Sonra</div>
                          <div className="num-sm text-foreground">
                            {h.new_lot} · {formatPrice(h.new_entry, trade.stock_symbol)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Partial-close hint */}
            {trade.remaining_lot < trade.lot_quantity && (
              <section className="rounded-xl p-4 border border-warning/30 bg-warning/5">
                <h3 className="text-label text-warning inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Kısmi Kapanış Var
                </h3>
                <p className="text-caption text-muted-foreground mt-1">
                  {trade.lot_quantity - trade.remaining_lot} lot daha önce kapatıldı. Kalan {trade.remaining_lot} lot hâlâ açık.
                </p>
              </section>
            )}
          </div>
        ) : (
          <EditTradeForm
            trade={trade}
            onSave={onSave}
            onDelete={onDelete}
            onCancel={onClose}
            isSubmitting={isSubmitting}
            hasPartialCloses={hasPartialCloses}
            showMergeHistory={false}
            className="flex-1 min-h-0"
          />
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function ProgressBar({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: 'profit' | 'loss';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneColor = tone === 'profit' ? 'text-profit' : 'text-loss';
  const toneBg = tone === 'profit' ? 'bg-profit' : 'bg-loss';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-caption text-muted-foreground inline-flex items-center gap-1">
          <Icon className={cn('w-3 h-3', toneColor)} />
          {label}
        </span>
        <span className={cn('num-sm font-semibold', toneColor)}>
          %{value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          className={cn('h-full transition-all', toneBg)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
