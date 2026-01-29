import { useState, useMemo } from 'react';
import { X, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
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
import { Trade, TradeType, TradeReason, TRADE_REASONS, STOP_REASONS, StopReason, ClosingType } from '@/types/trade';
import { cn } from '@/lib/utils';

export interface TradeUpdateData {
  trade_type: TradeType;
  entry_price: number;
  target_price: number;
  stop_price: number;
  reasons: string[];
  position_amount?: number | null;
  // Closed trade fields
  exit_price?: number | null;
  closing_type?: ClosingType | null;
  stop_reason?: string | null;
  closing_note?: string | null;
}

interface EditTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onSave: (tradeId: string, data: TradeUpdateData) => void;
  onDelete: (tradeId: string) => void;
  isSubmitting?: boolean;
}

export function EditTradeModal({ trade, onClose, onSave, onDelete, isSubmitting = false }: EditTradeModalProps) {
  const isClosed = trade.status === 'closed';

  // Form state
  const [tradeType, setTradeType] = useState<TradeType>(trade.trade_type);
  const [reasons, setReasons] = useState<TradeReason[]>(trade.reasons as TradeReason[]);
  const [entryPrice, setEntryPrice] = useState(trade.entry_price.toString());
  const [targetPrice, setTargetPrice] = useState(trade.target_price.toString());
  const [stopPrice, setStopPrice] = useState(trade.stop_price.toString());
  const [positionAmount, setPositionAmount] = useState(trade.position_amount?.toString() || '');
  
  // Closed trade fields
  const [exitPrice, setExitPrice] = useState(trade.exit_price?.toString() || '');
  const [closingType, setClosingType] = useState<ClosingType | null>(trade.closing_type || null);
  const [stopReason, setStopReason] = useState<StopReason | ''>(trade.stop_reason as StopReason || '');
  const [closingNote, setClosingNote] = useState(trade.closing_note || '');

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const parsedEntry = parseFloat(entryPrice);
  const parsedTarget = parseFloat(targetPrice);
  const parsedStop = parseFloat(stopPrice);
  const parsedPosition = parseFloat(positionAmount);
  const parsedExit = parseFloat(exitPrice);

  // Validation
  const hasEntryStopError = !isNaN(parsedEntry) && !isNaN(parsedStop) && parsedEntry === parsedStop;
  const hasNegativeEntry = !isNaN(parsedEntry) && parsedEntry <= 0;
  const hasNegativeTarget = !isNaN(parsedTarget) && parsedTarget <= 0;
  const hasNegativeStop = !isNaN(parsedStop) && parsedStop <= 0;
  const hasNegativePosition = !isNaN(parsedPosition) && parsedPosition <= 0;
  const hasAnyNegativeError = hasNegativeEntry || hasNegativeTarget || hasNegativeStop;

  const rrRatio = useMemo(() => {
    if (isNaN(parsedEntry) || isNaN(parsedTarget) || isNaN(parsedStop)) return null;
    if (parsedEntry === parsedStop) return null;
    if (parsedEntry <= 0 || parsedTarget <= 0 || parsedStop <= 0) return null;

    const rr = (parsedTarget - parsedEntry) / (parsedEntry - parsedStop);
    return Math.abs(rr);
  }, [parsedEntry, parsedTarget, parsedStop]);

  const toggleReason = (reasonId: TradeReason) => {
    setReasons((prev) =>
      prev.includes(reasonId)
        ? prev.filter((r) => r !== reasonId)
        : [...prev, reasonId]
    );
  };

  const handleSave = async () => {
    if (isSubmittingLocal || isSubmitting) return;
    if (!entryPrice || !targetPrice || !stopPrice) return;
    if (reasons.length === 0) return;
    if (hasEntryStopError || hasAnyNegativeError) return;

    // Closed trade validation
    if (isClosed) {
      if (!exitPrice || isNaN(parsedExit)) return;
      if (!closingType) return;
      if (closingType === 'stop' && !stopReason) return;
    }

    setIsSubmittingLocal(true);
    try {
      const updateData: TradeUpdateData = {
        trade_type: tradeType,
        entry_price: parsedEntry,
        target_price: parsedTarget,
        stop_price: parsedStop,
        reasons,
        position_amount: !isNaN(parsedPosition) && parsedPosition > 0 ? parsedPosition : null,
      };

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
    reasons.length > 0 &&
    rrRatio !== null &&
    !hasEntryStopError &&
    !hasAnyNegativeError &&
    (!isClosed || (exitPrice && closingType && (closingType === 'kar_al' || stopReason)));

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-lg max-h-[90vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fade-in flex flex-col">
          {/* Header */}
          <div className="border-b border-border p-4 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">İşlemi Düzenle</h2>
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{trade.stock_symbol}</span> - {trade.stock_name}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-5">
              {/* Trade Type Selection */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  İşlem Türü
                </label>
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

              {/* Trade Reasons */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  İşlem Sebepleri
                </label>
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
                      <Checkbox
                        checked={reasons.includes(reason.id)}
                        onCheckedChange={() => toggleReason(reason.id)}
                      />
                      <span className="text-foreground">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Inputs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Entry</label>
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
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Target</label>
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
                    className={cn('font-mono text-sm', (hasNegativeStop || hasEntryStopError) && 'border-loss')}
                  />
                </div>
              </div>

              {/* Validation Errors */}
              {(hasEntryStopError || hasAnyNegativeError) && (
                <div className="text-xs text-loss">
                  {hasEntryStopError && <p>⚠️ Stop fiyatı Entry fiyatından farklı olmalı</p>}
                  {hasAnyNegativeError && <p>⚠️ Fiyatlar sıfırdan büyük olmalı</p>}
                </div>
              )}

              {/* Position Amount */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  İşlem Tutarı (₺) - Opsiyonel
                </label>
                <NumberInput
                  step="1"
                  min="1"
                  placeholder="Örn: 10000"
                  value={positionAmount}
                  onChange={(e) => setPositionAmount(e.target.value)}
                  className={cn('font-mono', hasNegativePosition && 'border-loss')}
                />
              </div>

              {/* RR Display */}
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

              {/* Closed Trade Fields */}
              {isClosed && (
                <>
                  <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Kapanış Bilgileri</h3>
                    
                    {/* Exit Price */}
                    <div className="mb-3">
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Çıkış Fiyatı (Exit)
                      </label>
                      <NumberInput
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={exitPrice}
                        onChange={(e) => setExitPrice(e.target.value)}
                        className="font-mono"
                      />
                    </div>

                    {/* Closing Type */}
                    <div className="mb-3">
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Kapanış Türü
                      </label>
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

                    {/* Stop Reasons */}
                    {closingType === 'stop' && (
                      <div className="mb-3">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">
                          Stop Sebebi
                        </label>
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

                    {/* Closing Note */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Not (Opsiyonel)
                      </label>
                      <Textarea
                        placeholder="İşlem hakkında notlarınız..."
                        value={closingNote}
                        onChange={(e) => setClosingNote(e.target.value)}
                        className="resize-none h-16"
                        maxLength={500}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Delete Button */}
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

          {/* Footer */}
          <div className="border-t border-border p-4 flex gap-3 shrink-0">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              İptal
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={!isValid || isSubmitting || isSubmittingLocal}
            >
              {(isSubmitting || isSubmittingLocal) ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlemi silmek istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{trade.stock_symbol}</span> işlemi kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-loss hover:bg-loss/90"
              onClick={handleDelete}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
