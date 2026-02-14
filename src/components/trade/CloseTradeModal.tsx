import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trade, ClosingType, StopReason, STOP_REASONS } from '@/types/trade';
import { cn } from '@/lib/utils';

interface CloseTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onConfirm: (exitPrice: number, closingType: ClosingType, lotQuantity: number, stopReason?: string, closingNote?: string) => void;
}

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
    } else {
      return parsedExit < trade.entry_price ? 'kar_al' : 'stop';
    }
  }, [parsedExit, trade.trade_type, trade.entry_price]);

  // Calculate signed progress percentage
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
  }, [exitPrice, trade]);

  // Calculate realized PnL for display
  const realizedPnl = useMemo(() => {
    if (isNaN(parsedExit) || isNaN(parsedLot) || parsedLot <= 0) return null;
    if (trade.trade_type === 'buy') {
      return (parsedExit - trade.entry_price) * parsedLot;
    } else {
      return (trade.entry_price - parsedExit) * parsedLot;
    }
  }, [parsedExit, parsedLot, trade]);

  const handleCheckedChange = (id: StopReason, checked: boolean) => {
    if (checked) {
      setStopReasons([...stopReasons, id]);
    } else {
      setStopReasons(stopReasons.filter(r => r !== id));
    }
  };

  const handleFillAllLots = () => {
    setLotQuantity(trade.remaining_lot.toString());
  };

  const lotValid = !isNaN(parsedLot) && parsedLot > 0 && parsedLot <= trade.remaining_lot;

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

  const isValid = closingType !== null && 
    progressPercent !== null && 
    lotValid &&
    (closingType === 'kar_al' || (closingType === 'stop' && stopReasons.length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">İşlemi Kapat</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{trade.stock_symbol}</span> - {trade.stock_name}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Trade Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-secondary">
                <div className="text-xs text-muted-foreground mb-1">Giriş</div>
                <div className="font-mono font-semibold text-foreground">
                  ₺{trade.entry_price.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <div className="text-xs text-muted-foreground mb-1">Hedef</div>
                <div className="font-mono font-semibold text-foreground">
                  ₺{trade.target_price.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <div className="text-xs text-muted-foreground mb-1">Stop</div>
                <div className="font-mono font-semibold text-foreground">
                  ₺{trade.stop_price.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Exit Price Input */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Çıkış Fiyatı (Exit)
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

            {/* Lot Quantity Input */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Satılacak Lot
              </label>
              <div className="flex gap-2">
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
                  className="font-mono flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-10 text-xs"
                  onClick={handleFillAllLots}
                >
                  Tüm Lotlar ({trade.remaining_lot})
                </Button>
              </div>
              {!isNaN(parsedLot) && parsedLot > trade.remaining_lot && (
                <p className="text-xs text-loss mt-1">Kalan lot: {trade.remaining_lot}</p>
              )}
            </div>

            {/* Realized PnL Display */}
            {realizedPnl !== null && !isNaN(parsedExit) && (
              <div className={cn(
                'p-3 rounded-lg border text-center',
                realizedPnl >= 0 
                  ? 'border-profit/30 bg-profit/5' 
                  : 'border-loss/30 bg-loss/5'
              )}>
                <span className="text-sm text-muted-foreground">Gerçekleşen K/Z: </span>
                <span className={cn(
                  'font-mono font-bold',
                  realizedPnl >= 0 ? 'text-profit' : 'text-loss'
                )}>
                  {realizedPnl >= 0 ? '+' : ''}₺{realizedPnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Progress Display */}
            {progressPercent !== null && (
              <div className={cn(
                'p-3 rounded-lg border text-center',
                progressPercent >= 0 
                  ? 'border-profit/30 bg-profit/5' 
                  : 'border-loss/30 bg-loss/5'
              )}>
                <span className="text-sm text-muted-foreground">İlerleme: </span>
                <span className={cn(
                  'font-mono font-bold',
                  progressPercent >= 0 ? 'text-profit' : 'text-loss'
                )}>
                  %{progressPercent.toFixed(1)}
                </span>
              </div>
            )}

            {/* Auto-determined Closing Type Badge */}
            {closingType && (
              <div className="flex items-center justify-center">
                <Badge className={cn(
                  'text-sm px-4 py-1.5',
                  closingType === 'kar_al'
                    ? 'bg-profit/15 text-profit border-profit/30'
                    : 'bg-loss/15 text-loss border-loss/30'
                )}>
                  {closingType === 'kar_al' ? 'Kâr Al' : 'Stop'}
                </Badge>
              </div>
            )}

            {/* Stop Reasons - Çoklu Seçim */}
            {closingType === 'stop' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Stop Sebepleri (birden fazla seçebilirsiniz)
                </label>
                <div className="grid gap-2">
                  {STOP_REASONS.map((reason) => (
                    <Label
                      key={reason.id}
                      htmlFor={`stop-${reason.id}`}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        stopReasons.includes(reason.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      <Checkbox
                        id={`stop-${reason.id}`}
                        checked={stopReasons.includes(reason.id)}
                        onCheckedChange={(checked) => handleCheckedChange(reason.id, !!checked)}
                      />
                      <span className="text-sm text-foreground">{reason.label}</span>
                    </Label>
                  ))}
                </div>
              </div>
            )}

            {/* Closing Note */}
            {closingType && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Not (Opsiyonel)
                </label>
                <Textarea
                  placeholder="İşlem hakkında notlarınız..."
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="resize-none h-20"
                  maxLength={500}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border p-4 flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button
            variant={closingType === 'kar_al' ? 'buy' : 'sell'}
            className="flex-1"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            {parsedLot < trade.remaining_lot && lotValid ? 'Kısmi Çıkış' : 'İşlemi Kapat'}
          </Button>
        </div>
      </div>
    </div>
  );
}
