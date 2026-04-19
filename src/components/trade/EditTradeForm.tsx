import { useState, useMemo } from 'react';
import { Trash2, TrendingUp, TrendingDown, AlertTriangle, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Trade,
  TradeType,
  TradeReason,
  TRADE_REASONS,
  STOP_REASONS,
  StopReason,
  ClosingType,
} from '@/types/trade';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import { validateDirectional, calculateRR, calculatePositionAmount } from '@/lib/tradeValidation';
import type { TradeUpdateData } from './EditTradeModal';

interface EditTradeFormProps {
  trade: Trade;
  onSave: (tradeId: string, data: TradeUpdateData) => void;
  onDelete: (tradeId: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  hasPartialCloses?: boolean;
  /**
   * Merge history aynı dialog'un Detaylar tab'ında görüntülendiğinde
   * burada tekrar gösterilmemesi için false verilir.
   */
  showMergeHistory?: boolean;
  className?: string;
}

export function EditTradeForm({
  trade,
  onSave,
  onDelete,
  onCancel,
  isSubmitting = false,
  hasPartialCloses = false,
  showMergeHistory = true,
  className,
}: EditTradeFormProps) {
  const isClosed = trade.status === 'closed';

  const [tradeType, setTradeType] = useState<TradeType>(trade.trade_type);
  const [reasons, setReasons] = useState<TradeReason[]>(trade.reasons as TradeReason[]);
  const [entryPrice, setEntryPrice] = useState(trade.entry_price.toString());
  const [targetPrice, setTargetPrice] = useState(trade.target_price.toString());
  const [stopPrice, setStopPrice] = useState(trade.stop_price.toString());
  const [lotQuantity, setLotQuantity] = useState(trade.lot_quantity?.toString() || '0');

  const [exitPrice, setExitPrice] = useState(trade.exit_price?.toString() || '');
  const [closingType, setClosingType] = useState<ClosingType | null>(trade.closing_type || null);
  const [stopReason, setStopReason] = useState<StopReason | ''>((trade.stop_reason as StopReason) || '');
  const [closingNote, setClosingNote] = useState(trade.closing_note || '');

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const parsedEntry = parseFloat(entryPrice);
  const parsedTarget = parseFloat(targetPrice);
  const parsedStop = parseFloat(stopPrice);
  const parsedLot = parseInt(lotQuantity, 10);
  const parsedExit = parseFloat(exitPrice);

  const hasNegativeEntry = !isNaN(parsedEntry) && parsedEntry <= 0;
  const hasNegativeTarget = !isNaN(parsedTarget) && parsedTarget <= 0;
  const hasNegativeStop = !isNaN(parsedStop) && parsedStop <= 0;
  const hasAnyNegativeError = hasNegativeEntry || hasNegativeTarget || hasNegativeStop;

  const directionalErrors = useMemo(
    () => validateDirectional(tradeType, parsedEntry, parsedTarget, parsedStop),
    [tradeType, parsedEntry, parsedTarget, parsedStop]
  );

  const hasDirectionalError = directionalErrors.length > 0;
  const isLegacyLot = trade.lot_quantity === 0 && !isClosed;

  const rrRatio = useMemo(
    () => calculateRR(tradeType, parsedEntry, parsedTarget, parsedStop, hasDirectionalError),
    [parsedEntry, parsedTarget, parsedStop, tradeType, hasDirectionalError]
  );

  const positionAmount = useMemo(
    () => calculatePositionAmount(parsedEntry, parsedLot),
    [parsedEntry, parsedLot]
  );

  const toggleReason = (reasonId: TradeReason) => {
    setReasons((prev) => (prev.includes(reasonId) ? prev.filter((r) => r !== reasonId) : [...prev, reasonId]));
  };

  const handleSave = async () => {
    if (isSubmittingLocal || isSubmitting) return;
    if (!entryPrice || !targetPrice || !stopPrice) return;
    if (!isClosed && reasons.length === 0) return;
    if (hasAnyNegativeError || hasDirectionalError) return;

    if (isClosed) {
      if (!exitPrice || isNaN(parsedExit)) return;
      if (!closingType) return;
      if (closingType === 'stop' && !stopReason) return;
    }

    setIsSubmittingLocal(true);
    try {
      const updateData: TradeUpdateData & { remaining_lot?: number } = {
        trade_type: tradeType,
        entry_price: parsedEntry,
        target_price: parsedTarget,
        stop_price: parsedStop,
        reasons,
        lot_quantity: !isNaN(parsedLot) && parsedLot > 0 ? parsedLot : undefined,
      };

      if (!hasPartialCloses && !isClosed && !isNaN(parsedLot) && parsedLot > 0) {
        updateData.remaining_lot = parsedLot;
      }

      if (isClosed) {
        updateData.exit_price = parsedExit;
        updateData.closing_type = closingType;
        updateData.stop_reason = closingType === 'stop' ? stopReason : null;
        updateData.closing_note = closingNote.trim() || null;
      }

      await onSave(trade.id, updateData);
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const handleDelete = () => {
    onDelete(trade.id);
    setShowDeleteDialog(false);
  };

  const isValid =
    entryPrice &&
    targetPrice &&
    stopPrice &&
    (isClosed || reasons.length > 0) &&
    rrRatio !== null &&
    !hasAnyNegativeError &&
    !hasDirectionalError &&
    (!isClosed || (exitPrice && closingType && (closingType === 'kar_al' || stopReason)));

  const isLotDisabled = hasPartialCloses;

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-5">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">İşlem Türü</label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={tradeType === 'buy' ? 'buy' : 'outline'}
                className="h-11"
                onClick={() => setTradeType('buy')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                AL
              </Button>
              <Button
                type="button"
                variant={tradeType === 'sell' ? 'sell' : 'outline'}
                className="h-11"
                onClick={() => setTradeType('sell')}
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                SAT
              </Button>
            </div>
          </div>

          {!isClosed && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">İşlem Sebepleri</label>
              <div className="grid grid-cols-2 gap-2">
                {TRADE_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm',
                      reasons.includes(reason.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    <Checkbox checked={reasons.includes(reason.id)} onCheckedChange={() => toggleReason(reason.id)} />
                    <span className="text-foreground">{reason.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Giriş</label>
              <NumberInput
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className={cn('font-mono text-sm', hasNegativeEntry && 'border-loss')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Hedef</label>
              <NumberInput
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className={cn('font-mono text-sm', hasNegativeTarget && 'border-loss')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Stop</label>
              <NumberInput
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className={cn('font-mono text-sm', hasNegativeStop && 'border-loss')}
              />
            </div>
          </div>

          {(hasAnyNegativeError || hasDirectionalError) && (
            <div className="text-xs text-loss space-y-1">
              {hasAnyNegativeError && <p>⚠️ Fiyatlar sıfırdan büyük olmalı</p>}
              {directionalErrors.map((err, i) => (
                <p key={i}>⚠️ {err}</p>
              ))}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Lot / Kağıt Adedi</label>
            <NumberInput
              step="1"
              min="0"
              placeholder="Örn: 100"
              value={lotQuantity}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setLotQuantity(val);
              }}
              className="font-mono"
              disabled={isLotDisabled}
            />
            {isLotDisabled && (
              <p className="text-xs text-muted-foreground mt-1">🔒 Kısmi kapanışı olan işlemlerde lot değiştirilemez</p>
            )}
            {isLegacyLot && !isLotDisabled && (
              <p className="text-xs text-warning mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Bu işlemin lot bilgisi eksik, lütfen güncelleyin
              </p>
            )}
            {positionAmount !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                💰 İşlem Tutarı: ₺{positionAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {rrRatio !== null && (
            <div
              className={cn(
                'p-3 rounded-lg border text-center',
                rrRatio >= 3 ? 'border-profit/50 bg-profit/10' : 'border-loss/50 bg-loss/10'
              )}
            >
              <span className="text-sm text-muted-foreground">RR: </span>
              <span className={cn('font-mono font-bold', rrRatio >= 3 ? 'text-profit' : 'text-loss')}>
                {rrRatio.toFixed(2)}
              </span>
            </div>
          )}

          {showMergeHistory && trade.merge_count > 1 && trade.merge_history && trade.merge_history.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Birleşme Geçmişi ({trade.merge_history.length})
              </h3>
              <div className="space-y-2">
                {trade.merge_history.map((h, i) => {
                  let dateStr = h.merged_at;
                  try {
                    dateStr = format(parseISO(h.merged_at), 'd MMM yyyy HH:mm', { locale: tr });
                  } catch {
                    // fallback
                  }
                  return (
                    <div key={i} className="p-2 rounded-lg border border-border bg-secondary/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">#{i + 1}</span>
                        <span className="text-muted-foreground">{dateStr}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div className="text-muted-foreground">
                          <div className="text-caption">Önce</div>
                          <div className="font-mono">
                            {h.original_lot} lot @ {formatPrice(h.original_entry, trade.stock_symbol)}
                          </div>
                        </div>
                        <div className="text-primary">
                          <div className="text-caption">Eklenen</div>
                          <div className="font-mono">
                            +{h.added_lot} lot @ {formatPrice(h.added_entry, trade.stock_symbol)}
                          </div>
                        </div>
                        <div className="text-profit">
                          <div className="text-caption">Sonra</div>
                          <div className="font-mono">
                            {h.new_lot} lot @ {formatPrice(h.new_entry, trade.stock_symbol)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isClosed && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Kapanış Bilgileri</h3>

              <div className="mb-3">
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Çıkış Fiyatı (Exit)</label>
                <NumberInput
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="mb-3">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Kapanış Türü</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={closingType === 'kar_al' ? 'buy' : 'outline'}
                    className="h-10"
                    onClick={() => {
                      setClosingType('kar_al');
                      setStopReason('');
                    }}
                  >
                    Kâr Al
                  </Button>
                  <Button
                    type="button"
                    variant={closingType === 'stop' ? 'sell' : 'outline'}
                    className="h-10"
                    onClick={() => setClosingType('stop')}
                  >
                    Stop
                  </Button>
                </div>
              </div>

              {closingType === 'stop' && (
                <div className="mb-3">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Stop Sebebi</label>
                  <RadioGroup
                    value={stopReason}
                    onValueChange={(value) => setStopReason(value as StopReason)}
                    className="grid gap-1.5 max-h-[180px] overflow-y-auto"
                  >
                    {STOP_REASONS.map((reason) => (
                      <Label
                        key={reason.id}
                        htmlFor={`edit-${reason.id}`}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm',
                          stopReason === reason.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-muted-foreground/50'
                        )}
                      >
                        <RadioGroupItem value={reason.id} id={`edit-${reason.id}`} />
                        <span className="text-foreground">{reason.label}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Not (Opsiyonel)</label>
                <Textarea
                  placeholder="İşlem hakkında notlarınız..."
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="resize-none h-16"
                  maxLength={500}
                />
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="w-full text-loss border-loss/30 hover:bg-loss/10 hover:text-loss"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              İşlemi Sil
            </Button>
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4 flex gap-3 shrink-0">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          İptal
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={!isValid || isSubmitting || isSubmittingLocal}>
          {isSubmitting || isSubmittingLocal ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlemi silmek istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{trade.stock_symbol}</span> işlemi kalıcı olarak silinecek. Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction className="bg-loss hover:bg-loss/90" onClick={handleDelete}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
