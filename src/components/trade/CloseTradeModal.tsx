import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter,
} from '@/components/ui/bottom-sheet';
import { Trade, ClosingType, StopReason, STOP_REASONS } from '@/types/trade';
import { cn } from '@/lib/utils';
import { formatPrice, getCurrencySymbol } from '@/lib/currency';

interface CloseTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onConfirm: (
    exitPrice: number,
    closingType: ClosingType,
    lotQuantity: number,
    stopReason?: string,
    closingNote?: string
  ) => void;
}

/**
 * CloseTradeModal — bottom-sheet form for closing a position.
 *
 * Closing type (Kâr Al / Stop) is inferred from exit vs entry; user
 * doesn't need to choose it explicitly. Stop reasons appear only when
 * the close is a loss.
 */
export function CloseTradeModal({ trade, onClose, onConfirm }: CloseTradeModalProps) {
  const [exitPrice, setExitPrice] = useState('');
  const [lotQuantity, setLotQuantity] = useState(trade.remaining_lot.toString());
  const [stopReasons, setStopReasons] = useState<StopReason[]>([]);
  const [closingNote, setClosingNote] = useState('');

  const parsedExit = parseFloat(exitPrice);
  const parsedLot = parseInt(lotQuantity, 10);

  const closingType: ClosingType | null = useMemo(() => {
    if (isNaN(parsedExit) || parsedExit <= 0) return null;
    if (trade.trade_type === 'buy') {
      return parsedExit > trade.entry_price ? 'kar_al' : 'stop';
    }
    return parsedExit < trade.entry_price ? 'kar_al' : 'stop';
  }, [parsedExit, trade.trade_type, trade.entry_price]);

  const progressPercent = useMemo(() => {
    if (isNaN(parsedExit)) return null;
    const entry = trade.entry_price;
    const target = trade.target_price;
    let movement: number;
    let targetMovement: number;
    if (trade.trade_type === 'buy') {
      movement = parsedExit - entry;
      targetMovement = target - entry;
    } else {
      movement = entry - parsedExit;
      targetMovement = entry - target;
    }
    if (targetMovement === 0) return 0;
    return (movement / targetMovement) * 100;
  }, [parsedExit, trade]);

  const realizedPnl = useMemo(() => {
    if (isNaN(parsedExit) || isNaN(parsedLot) || parsedLot <= 0) return null;
    if (trade.trade_type === 'buy') {
      return (parsedExit - trade.entry_price) * parsedLot;
    }
    return (trade.entry_price - parsedExit) * parsedLot;
  }, [parsedExit, parsedLot, trade]);

  const handleCheckedChange = (id: StopReason, checked: boolean) => {
    if (checked) setStopReasons([...stopReasons, id]);
    else setStopReasons(stopReasons.filter((r) => r !== id));
  };

  const handleFillAllLots = () => setLotQuantity(trade.remaining_lot.toString());

  const lotValid =
    !isNaN(parsedLot) && parsedLot > 0 && parsedLot <= trade.remaining_lot;

  const handleConfirm = () => {
    if (!closingType || progressPercent === null || !lotValid) return;
    if (closingType === 'stop' && stopReasons.length === 0) return;
    onConfirm(
      parsedExit,
      closingType,
      parsedLot,
      closingType === 'stop' ? stopReasons.join(',') : undefined,
      closingNote.trim() || undefined
    );
  };

  const isValid =
    closingType !== null &&
    progressPercent !== null &&
    lotValid &&
    (closingType === 'kar_al' || (closingType === 'stop' && stopReasons.length > 0));

  const isPartial = parsedLot < trade.remaining_lot && lotValid;
  const currency = getCurrencySymbol(trade.stock_symbol);

  return (
    <BottomSheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheetContent size="md">
        <BottomSheetHeader>
          <BottomSheetTitle>İşlemi Kapat</BottomSheetTitle>
          <BottomSheetDescription>
            <span className="font-semibold text-foreground">{trade.stock_symbol}</span>
            {' · '}
            {trade.stock_name}
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody className="space-y-4">
          {/* Trade summary triad */}
          <div className="grid grid-cols-3 gap-2">
            <SummaryCell label="Giriş" value={formatPrice(trade.entry_price, trade.stock_symbol)} />
            <SummaryCell label="Hedef" value={formatPrice(trade.target_price, trade.stock_symbol)} tone="profit" />
            <SummaryCell label="Stop" value={formatPrice(trade.stop_price, trade.stock_symbol)} tone="loss" />
          </div>

          {/* Exit price */}
          <div>
            <label className="text-label text-muted-foreground mb-1.5 block">
              Çıkış Fiyatı
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="font-mono text-lg h-12"
              autoFocus
            />
          </div>

          {/* Lot */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-label text-muted-foreground">Satılacak Lot</label>
              <button
                type="button"
                onClick={handleFillAllLots}
                className="text-caption text-primary hover:underline"
              >
                Tümü ({trade.remaining_lot})
              </button>
            </div>
            <NumberInput
              step="1"
              min="1"
              max={trade.remaining_lot.toString()}
              placeholder="Lot adedi"
              value={lotQuantity}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setLotQuantity(val);
              }}
              className="font-mono"
            />
            {!isNaN(parsedLot) && parsedLot > trade.remaining_lot && (
              <p className="text-caption text-loss mt-1">
                Kalan lot: {trade.remaining_lot}
              </p>
            )}
          </div>

          {/* Realized PnL + progress + closing-type inline card */}
          {closingType && realizedPnl !== null && progressPercent !== null && (
            <div
              className={cn(
                'p-3 rounded-lg border',
                realizedPnl >= 0
                  ? 'border-profit/30 bg-profit-soft'
                  : 'border-loss/30 bg-loss-soft'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-caption', realizedPnl >= 0 ? 'text-profit' : 'text-loss')}>
                  {closingType === 'kar_al' ? 'Kâr Al' : 'Stop'}
                </span>
                <span className={cn('text-caption font-mono', realizedPnl >= 0 ? 'text-profit' : 'text-loss')}>
                  %{progressPercent.toFixed(1)} ilerleme
                </span>
              </div>
              <div
                className={cn(
                  'num-lg mt-1',
                  realizedPnl >= 0 ? 'text-profit' : 'text-loss'
                )}
              >
                {realizedPnl >= 0 ? '+' : '−'}
                {currency}
                {Math.abs(realizedPnl).toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          )}

          {/* Stop reasons — only when closing at a loss */}
          {closingType === 'stop' && (
            <div>
              <label className="text-label text-muted-foreground mb-2 block">
                Stop Sebepleri
                <span className="text-caption ml-1">(birden fazla seçebilirsiniz)</span>
              </label>
              <div className="grid gap-1.5">
                {STOP_REASONS.map((reason) => (
                  <Label
                    key={reason.id}
                    htmlFor={`stop-${reason.id}`}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      stopReasons.includes(reason.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border-subtle hover:border-border'
                    )}
                  >
                    <Checkbox
                      id={`stop-${reason.id}`}
                      checked={stopReasons.includes(reason.id)}
                      onCheckedChange={(checked) => handleCheckedChange(reason.id, !!checked)}
                    />
                    <span className="text-body text-foreground">{reason.label}</span>
                  </Label>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {closingType && (
            <div>
              <label className="text-label text-muted-foreground mb-1.5 block">
                Not{' '}
                <span className="text-caption">(opsiyonel)</span>
              </label>
              <Textarea
                placeholder="İşlem hakkında notlarınız…"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                className="resize-none h-20"
                maxLength={500}
              />
            </div>
          )}
        </BottomSheetBody>

        <BottomSheetFooter>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button
            variant={closingType === 'kar_al' ? 'buy' : 'sell'}
            className="flex-1"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            {isPartial ? 'Kısmi Çıkış' : 'İşlemi Kapat'}
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
}) {
  return (
    <div className="p-3 rounded-lg bg-surface-1 border border-border-subtle text-center">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div
        className={cn(
          'num mt-0.5',
          tone === 'profit' && 'text-profit/90',
          tone === 'loss' && 'text-loss/90',
          !tone && 'text-foreground'
        )}
      >
        {value}
      </div>
    </div>
  );
}
