import { useState, useMemo } from 'react';
import { X, TrendingUp, CircleStop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trade, ClosingType, StopReason, STOP_REASONS } from '@/types/trade';
import { cn } from '@/lib/utils';

interface CloseTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onConfirm: (exitPrice: number, closingType: ClosingType, stopReason?: string, closingNote?: string) => void;
}

export function CloseTradeModal({ trade, onClose, onConfirm }: CloseTradeModalProps) {
  const [exitPrice, setExitPrice] = useState('');
  const [closingType, setClosingType] = useState<ClosingType | null>(null);
  const [stopReason, setStopReason] = useState<StopReason | ''>('');
  const [closingNote, setClosingNote] = useState('');

  // Calculate signed progress percentage
  const progressPercent = useMemo(() => {
    const exit = parseFloat(exitPrice);
    if (isNaN(exit)) return null;

    const entry = trade.entry_price;
    const target = trade.target_price;

    let movement: number;
    let targetMovement: number;

    if (trade.trade_type === 'buy') {
      // Long: positive if exit > entry
      movement = exit - entry;
      targetMovement = target - entry;
    } else {
      // Short: positive if exit < entry
      movement = entry - exit;
      targetMovement = entry - target;
    }

    if (targetMovement === 0) return 0;

    return (movement / targetMovement) * 100;
  }, [exitPrice, trade]);

  const handleConfirm = () => {
    if (!closingType || progressPercent === null) return;
    if (closingType === 'stop' && !stopReason) return;
    
    onConfirm(
      parseFloat(exitPrice),
      closingType,
      closingType === 'stop' ? stopReason : undefined,
      closingNote.trim() || undefined
    );
  };

  const isValid = closingType !== null && 
    progressPercent !== null && 
    (closingType === 'kar_al' || (closingType === 'stop' && stopReason));

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
                <div className="text-xs text-muted-foreground mb-1">Entry</div>
                <div className="font-mono font-semibold text-foreground">
                  ₺{trade.entry_price.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <div className="text-xs text-muted-foreground mb-1">Target</div>
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

            {/* Closing Type Selection */}
            {progressPercent !== null && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Kapanış Türü
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={closingType === 'kar_al' ? 'buy' : 'outline'}
                    className="h-14 flex-col gap-1"
                    onClick={() => {
                      setClosingType('kar_al');
                      setStopReason('');
                    }}
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span>Kâr Al</span>
                  </Button>
                  <Button
                    type="button"
                    variant={closingType === 'stop' ? 'sell' : 'outline'}
                    className="h-14 flex-col gap-1"
                    onClick={() => setClosingType('stop')}
                  >
                    <CircleStop className="w-5 h-5" />
                    <span>Stop</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Stop Reasons */}
            {closingType === 'stop' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Stop Sebebi
                </label>
                <RadioGroup
                  value={stopReason}
                  onValueChange={(value) => setStopReason(value as StopReason)}
                  className="grid gap-2"
                >
                  {STOP_REASONS.map((reason) => (
                    <Label
                      key={reason.id}
                      htmlFor={reason.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        stopReason === reason.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      <RadioGroupItem value={reason.id} id={reason.id} />
                      <span className="text-sm text-foreground">{reason.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
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
            İşlemi Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
