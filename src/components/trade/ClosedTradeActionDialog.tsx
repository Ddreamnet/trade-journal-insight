import { useEffect, useMemo } from 'react';
import { Undo2, Trash2, Clock, Layers, Scissors } from 'lucide-react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
} from '@/components/ui/bottom-sheet';
import { StatRow, StatRowGroup } from '@/components/ui/stat-row';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MergedClosedTrade } from '@/lib/tradeMerge';
import { calculateProfitPct, convertPnL } from '@/lib/tradeMerge';
import { calculateInflationImpact, calculatePurchasingPowerChange } from '@/lib/inflationUtils';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { formatPrice, getSymbolCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface ClosedTradeActionDialogProps {
  merged: MergedClosedTrade | null;
  confirmAction: 'revert' | 'delete' | null;
  onAction: (action: 'revert' | 'delete') => void;
  onConfirm: () => void;
  onClose: () => void;
  onCancelConfirm: () => void;
}

/**
 * ClosedTradeActionDialog — bottom sheet showing a merged closed trade.
 *
 * Content blocks:
 *   1. Summary — weighted entry/exit, total lot, total P&L
 *   2. Enflasyon comparison (open → last close vs TÜFE)
 *   3. Partial closes (chronological)
 *   4. Source trades (if merged)
 *
 * Primary actions — revert / delete the latest partial close — sit in a
 * sticky footer to stay reachable on long sheets.
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

export function ClosedTradeActionDialog({
  merged,
  confirmAction,
  onAction,
  onConfirm,
  onClose,
  onCancelConfirm,
}: ClosedTradeActionDialogProps) {
  const { getSeriesData, fetchSeries } = useMarketSeries();

  useEffect(() => {
    if (!merged) return;
    void fetchSeries('inflation_tr');
    void fetchSeries('usd');
  }, [merged, fetchSeries]);

  const inflationData = getSeriesData('inflation_tr');
  const usdData = getSeriesData('usd');
  const usdTryRate = usdData?.points?.length
    ? [...usdData.points].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.value ?? null
    : null;

  const currency = merged ? getSymbolCurrency(merged.stock_symbol) : 'TRY';

  const overallProfitPct = useMemo(() => {
    if (!merged) return 0;
    return calculateProfitPct(merged.trade_type, merged.weighted_entry, merged.weighted_exit);
  }, [merged]);

  const totalPnlConv = useMemo(() => {
    if (!merged) return null;
    return convertPnL(merged.total_realized_pnl, merged.stock_symbol, usdTryRate);
  }, [merged, usdTryRate]);

  const inflation = useMemo(() => {
    if (!merged) return null;
    return calculateInflationImpact(
      merged.first_opened_at,
      merged.last_closed_at,
      inflationData?.points
    );
  }, [merged, inflationData]);

  const purchasingPowerChange = useMemo(() => {
    if (!inflation) return null;
    return calculatePurchasingPowerChange(overallProfitPct, inflation.cumulativePct);
  }, [inflation, overallProfitPct]);

  const partialDetails = useMemo(() => {
    if (!merged) return [];
    return merged.partial_closes.map((pc) => {
      const parent = merged.source_trades.find((t) => t.id === pc.trade_id);
      const openedAt = parent?.created_at ?? pc.created_at;
      const days = Math.max(
        1,
        differenceInCalendarDays(parseISO(pc.created_at), parseISO(openedAt))
      );
      const pnlConv = convertPnL(pc.realized_pnl ?? 0, pc.stock_symbol, usdTryRate);
      const profitPct = calculateProfitPct(pc.trade_type, pc.entry_price, pc.exit_price);
      return { pc, openedAt, days, pnlConv, profitPct };
    });
  }, [merged, usdTryRate]);

  // Additional insights — what's not already on screen that helps a trader
  // reason about the outcome: position value, inflation-adjusted real
  // profit in TL, time-adjusted performance (daily and annualized).
  const extras = useMemo(() => {
    if (!merged) return null;

    const toTl = (native: number): number | null =>
      currency === 'TRY' ? native : usdTryRate ? native * usdTryRate : null;

    const entryCostTl = toTl(merged.weighted_entry * merged.total_lot);
    const exitValueTl = toTl(merged.weighted_exit * merged.total_lot);

    const realPnlTl =
      entryCostTl !== null && purchasingPowerChange !== null
        ? (entryCostTl * purchasingPowerChange) / 100
        : null;

    const days = inflation?.daysHeld ?? null;
    const dailyPct = days && days > 0 ? overallProfitPct / days : null;
    const annualizedPct =
      days && days > 0
        ? (Math.pow(1 + overallProfitPct / 100, 365 / days) - 1) * 100
        : null;

    // Per-lot average profit in TL — useful for comparing trade sizes.
    const perLotPnlTl =
      totalPnlConv?.try !== null && totalPnlConv?.try !== undefined && merged.total_lot > 0
        ? totalPnlConv.try / merged.total_lot
        : null;

    return {
      entryCostTl,
      exitValueTl,
      realPnlTl,
      dailyPct,
      annualizedPct,
      perLotPnlTl,
    };
  }, [merged, currency, usdTryRate, purchasingPowerChange, inflation, overallProfitPct, totalPnlConv]);

  const latestPartial = merged?.partial_closes.at(-1) ?? null;
  const isUp = (totalPnlConv?.try ?? 0) >= 0;

  return (
    <>
      <BottomSheet
        open={!!merged && !confirmAction}
        onOpenChange={(open) => { if (!open) onClose(); }}
      >
        <BottomSheetContent size="lg" className="flex flex-col">
          <BottomSheetHeader>
            <BottomSheetTitle>
              {merged?.stock_symbol} — İşlem Sonuç Formu
            </BottomSheetTitle>
            <BottomSheetDescription>{merged?.stock_name}</BottomSheetDescription>
          </BottomSheetHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {/* P&L hero */}
            {merged && totalPnlConv && (
              <div
                className={cn(
                  'p-4 rounded-xl',
                  isUp ? 'bg-profit-soft' : 'bg-loss-soft'
                )}
              >
                <div className={cn('text-caption', isUp ? 'text-profit' : 'text-loss')}>
                  Toplam Gerçekleşen K/Z
                </div>
                <div
                  className={cn(
                    'num-display mt-1',
                    isUp ? 'text-profit' : 'text-loss'
                  )}
                >
                  {totalPnlConv.try !== null
                    ? `${totalPnlConv.try >= 0 ? '+' : '−'}${formatTL(Math.abs(totalPnlConv.try))}`
                    : '—'}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn('text-label font-mono font-semibold', isUp ? 'text-profit' : 'text-loss')}>
                    {overallProfitPct >= 0 ? '+' : ''}
                    {overallProfitPct.toFixed(2)}%
                  </span>
                  {totalPnlConv.usd !== null && currency === 'TRY' && (
                    <span className="text-caption text-muted-foreground">
                      {totalPnlConv.usd >= 0 ? '+' : '−'}
                      {formatUSD(Math.abs(totalPnlConv.usd))}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            {merged && (
              <section className="rounded-xl p-4 surface-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-label text-muted-foreground inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    İşlem Özeti
                  </h3>
                  {inflation && (
                    <span className="text-caption text-muted-foreground">
                      {inflation.daysHeld} gün
                    </span>
                  )}
                </div>

                <StatRowGroup className="bg-transparent border-0 px-0">
                  <StatRow
                    label="Tür"
                    value={merged.trade_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                    tone={merged.trade_type === 'buy' ? 'profit' : 'loss'}
                    valueType="text"
                    dense
                  />
                  <StatRow label="Toplam lot" value={merged.total_lot} dense />
                  <StatRow
                    label="Ortalama giriş"
                    value={formatPrice(merged.weighted_entry, merged.stock_symbol)}
                    dense
                  />
                  <StatRow
                    label="Ortalama çıkış"
                    value={formatPrice(merged.weighted_exit, merged.stock_symbol)}
                    dense
                  />
                  <StatRow
                    label="Açılış"
                    value={formatDate(merged.first_opened_at)}
                    valueType="text"
                    dense
                  />
                  <StatRow
                    label="Kapanış"
                    value={formatDate(merged.last_closed_at)}
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
                  {extras?.exitValueTl !== null && extras?.exitValueTl !== undefined && (
                    <StatRow
                      label="Çıkış tutarı"
                      value={formatTL(extras.exitValueTl)}
                      tone={isUp ? 'profit' : 'loss'}
                      dense
                    />
                  )}
                  {extras?.perLotPnlTl !== null && extras?.perLotPnlTl !== undefined && (
                    <StatRow
                      label="Lot başına kâr"
                      value={`${extras.perLotPnlTl >= 0 ? '+' : '−'}${formatTL(Math.abs(extras.perLotPnlTl))}`}
                      tone={extras.perLotPnlTl >= 0 ? 'profit' : 'loss'}
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
            )}

            {/* Inflation */}
            {merged && inflation && (
              <section className="rounded-xl p-4 surface-1 space-y-2">
                <h3 className="text-label text-muted-foreground">
                  Enflasyon Karşılaştırması
                </h3>
                <p className="text-caption text-muted-foreground leading-relaxed">
                  Aylık TÜFE %{inflation.monthlyRatePct.toFixed(2)} → günlük
                  %{inflation.dailyRatePct.toFixed(4)} × {inflation.daysHeld} gün.
                </p>
                <StatRowGroup className="bg-transparent border-0 px-0">
                  <StatRow
                    label="Dönem enflasyonu"
                    value={`%${inflation.cumulativePct.toFixed(2)}`}
                    dense
                  />
                  <StatRow
                    label="İşlem getirisi"
                    value={`${overallProfitPct >= 0 ? '+' : ''}%${overallProfitPct.toFixed(2)}`}
                    tone={overallProfitPct >= 0 ? 'profit' : 'loss'}
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

            {/* Partial closes */}
            {merged && partialDetails.length > 0 && (
              <section className="rounded-xl p-4 surface-1 space-y-2">
                <h3 className="text-label text-muted-foreground inline-flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5" />
                  Parçalı Kapatmalar ({partialDetails.length})
                </h3>
                <div className="space-y-1.5">
                  {partialDetails.map(({ pc, days, pnlConv, profitPct }, i) => (
                    <div key={pc.id} className="p-3 rounded-lg bg-surface-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-2">
                          <span className="text-label text-foreground">#{i + 1}</span>
                          <span className="text-label text-muted-foreground">{pc.lot_quantity} lot</span>
                        </div>
                        <span
                          className={cn(
                            'text-caption px-1.5 py-0.5 rounded',
                            pc.closing_type === 'kar_al'
                              ? 'bg-profit-soft text-profit'
                              : 'bg-loss-soft text-loss'
                          )}
                        >
                          {pc.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-caption text-muted-foreground">Kapanış</div>
                          <div className="num-sm text-foreground">
                            {formatDate(pc.created_at)}
                          </div>
                        </div>
                        <div>
                          <div className="text-caption text-muted-foreground">Çıkış</div>
                          <div className="num-sm text-foreground">
                            {formatPrice(pc.exit_price, pc.stock_symbol)}
                          </div>
                        </div>
                        <div>
                          <div className="text-caption text-muted-foreground">Süre</div>
                          <div className="num-sm text-foreground">{days} gün</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-caption text-muted-foreground">Kâr</span>
                        <span
                          className={cn(
                            'num-sm font-semibold',
                            profitPct >= 0 ? 'text-profit' : 'text-loss'
                          )}
                        >
                          {pnlConv.try !== null
                            ? `${pnlConv.try >= 0 ? '+' : '−'}${formatTL(Math.abs(pnlConv.try))}`
                            : '—'}
                          <span className="ml-1 text-caption">
                            ({profitPct >= 0 ? '+' : ''}%{profitPct.toFixed(2)})
                          </span>
                        </span>
                      </div>
                      {pc.closing_note && (
                        <div className="text-caption text-muted-foreground italic line-clamp-2">
                          "{pc.closing_note}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Source trades (merge) */}
            {merged && merged.source_trades.length > 1 && (
              <section className="rounded-xl p-4 surface-1 space-y-2">
                <h3 className="text-label text-muted-foreground inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Birleşmiş İşlemler ({merged.source_trades.length})
                </h3>
                <div className="space-y-1">
                  {merged.source_trades.map((t, i) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2"
                    >
                      <div className="inline-flex items-center gap-2">
                        <span className="text-caption text-muted-foreground">#{i + 1}</span>
                        <span className="text-label text-foreground">
                          {formatDate(t.created_at)}
                        </span>
                      </div>
                      <div className="text-label text-muted-foreground">
                        <span className="num-sm">{t.lot_quantity}</span> lot · {' '}
                        <span className="num-sm">
                          {formatPrice(t.entry_price, t.stock_symbol)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-border-subtle px-5 py-3 flex gap-2 shrink-0">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => onAction('revert')}
              disabled={!latestPartial}
            >
              <Undo2 className="w-4 h-4" />
              Geri Al
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 text-loss border-loss/30 hover:bg-loss/10 hover:text-loss"
              onClick={() => onAction('delete')}
              disabled={!latestPartial}
            >
              <Trash2 className="w-4 h-4" />
              Sil
            </Button>
          </div>
        </BottomSheetContent>
      </BottomSheet>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) onCancelConfirm(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'revert' ? 'Son Kapanışı Geri Al' : 'Son Kapanışı Sil'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'revert'
                ? `${merged?.stock_symbol} için en son kapatma kaydını (${latestPartial?.lot_quantity ?? 0} lot) geri almak istediğinize emin misiniz? Lotlar ana işleme geri eklenecektir.`
                : `${merged?.stock_symbol} için en son kapatma kaydını (${latestPartial?.lot_quantity ?? 0} lot) kalıcı olarak silmek istediğinize emin misiniz? Lotlar ana işleme geri eklenecektir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className={confirmAction === 'delete' ? 'bg-loss hover:bg-loss/90' : ''}
            >
              {confirmAction === 'revert' ? 'Geri Al' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
