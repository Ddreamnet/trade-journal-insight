import { useState, useMemo } from 'react';
import { X, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trade } from '@/types/trade';
import { cn } from '@/lib/utils';

interface CloseTradeModalProps {
  trade: Trade;
  onClose: () => void;
  onConfirm: (exitPrice: number, progressPercent: number, result: 'success' | 'failure') => void;
}

export function CloseTradeModal({ trade, onClose, onConfirm }: CloseTradeModalProps) {
  const [exitPrice, setExitPrice] = useState('');

  const { progressPercent, result } = useMemo(() => {
    const exit = parseFloat(exitPrice);
    if (isNaN(exit)) return { progressPercent: null, result: null };

    const entry = trade.entry_price;
    const target = trade.target_price;

    // Progress = (|X - E| / |T - E|) * 100
    const progress = (Math.abs(exit - entry) / Math.abs(target - entry)) * 100;
    const tradeResult: 'success' | 'failure' = progress >= 50 ? 'success' : 'failure';

    return { progressPercent: progress, result: tradeResult };
  }, [exitPrice, trade]);

  const handleConfirm = () => {
    if (progressPercent === null || result === null) return;
    onConfirm(parseFloat(exitPrice), progressPercent, result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-background-secondary border border-border rounded-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="border-b border-border p-4">
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

          {/* Result Preview */}
          {progressPercent !== null && result && (
            <div
              className={cn(
                'p-4 rounded-lg border',
                result === 'success'
                  ? 'border-profit/50 bg-profit/10'
                  : 'border-loss/50 bg-loss/10'
              )}
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                {result === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-profit" />
                ) : (
                  <XCircle className="w-6 h-6 text-loss" />
                )}
                <span
                  className={cn(
                    'text-lg font-semibold',
                    result === 'success' ? 'text-profit' : 'text-loss'
                  )}
                >
                  {result === 'success' ? '✅ Başarılı İşlem' : '❌ Başarısız İşlem'}
                </span>
              </div>
              <div className="text-center">
                <span className="text-sm text-muted-foreground">İlerleme: </span>
                <span
                  className={cn(
                    'font-mono font-bold',
                    result === 'success' ? 'text-profit' : 'text-loss'
                  )}
                >
                  %{progressPercent.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button
            variant={result === 'success' ? 'buy' : 'sell'}
            className="flex-1"
            onClick={handleConfirm}
            disabled={progressPercent === null}
          >
            İşlemi Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
