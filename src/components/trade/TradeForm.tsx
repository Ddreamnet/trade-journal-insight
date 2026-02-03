import { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Checkbox } from '@/components/ui/checkbox';
import { StockLogo } from '@/components/ui/stock-logo';
import { Stock, TradeType, StopReason, STOP_REASONS } from '@/types/trade';
import { cn } from '@/lib/utils';

interface TradeFormProps {
  stock: Stock & { logoUrl?: string };
  onClose: () => void;
  onSave: (trade: {
    stock_symbol: string;
    stock_name: string;
    trade_type: 'buy' | 'sell';
    entry_price: number;
    target_price: number;
    stop_price: number;
    reasons: string[];
    position_amount?: number;
  }) => void;
  isSubmitting?: boolean;
}

export function TradeForm({ stock, onClose, onSave, isSubmitting = false }: TradeFormProps) {
  const [tradeType, setTradeType] = useState<TradeType | null>(null);
  const [reasons, setReasons] = useState<StopReason[]>([]);
  const [entryPrice, setEntryPrice] = useState(stock.currentPrice.toString());
  const [targetPrice, setTargetPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [positionAmount, setPositionAmount] = useState('');
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const parsedEntry = parseFloat(entryPrice);
  const parsedTarget = parseFloat(targetPrice);
  const parsedStop = parseFloat(stopPrice);
  const parsedPosition = parseFloat(positionAmount);

  // Validation checks
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

  const toggleReason = (reasonId: StopReason) => {
    setReasons((prev) =>
      prev.includes(reasonId)
        ? prev.filter((r) => r !== reasonId)
        : [...prev, reasonId]
    );
  };

  const handleSave = async () => {
    if (isSubmittingLocal || isSubmitting) return; // Double-click protection
    if (!tradeType || !entryPrice || !targetPrice || !stopPrice) return;
    if (reasons.length === 0) return;
    if (hasEntryStopError || hasAnyNegativeError) return;

    setIsSubmittingLocal(true);
    try {
      await onSave({
        stock_symbol: stock.symbol,
        stock_name: stock.name,
        trade_type: tradeType,
        entry_price: parsedEntry,
        target_price: parsedTarget,
        stop_price: parsedStop,
        reasons,
        position_amount: !isNaN(parsedPosition) && parsedPosition > 0 ? parsedPosition : undefined,
      });
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const isValid =
    tradeType &&
    entryPrice &&
    targetPrice &&
    stopPrice &&
    reasons.length > 0 &&
    rrRatio !== null &&
    !hasEntryStopError &&
    !hasAnyNegativeError;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-in-right sm:animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 bg-background-secondary border-b border-border p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StockLogo 
                symbol={stock.symbol} 
                logoUrl={stock.logoUrl}
                size="md"
              />
              <div>
                <div className="font-semibold text-foreground">{stock.symbol}</div>
                <div className="text-sm text-muted-foreground">{stock.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="font-mono text-foreground">
                  ₺{stock.currentPrice.toFixed(2)}
                </div>
                <div
                  className={cn(
                    'flex items-center justify-end gap-1 text-sm',
                    stock.change >= 0 ? 'text-profit' : 'text-loss'
                  )}
                >
                  {stock.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>
                    {stock.change >= 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[70vh] p-4 space-y-6">
          {/* Trade Type Selection */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              İşlem Türü
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={tradeType === 'buy' ? 'buy' : 'outline'}
                className="h-12"
                onClick={() => setTradeType('buy')}
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                AL
              </Button>
              <Button
                variant={tradeType === 'sell' ? 'sell' : 'outline'}
                className="h-12"
                onClick={() => setTradeType('sell')}
              >
                <TrendingDown className="w-5 h-5 mr-2" />
                SAT
              </Button>
            </div>
          </div>

          {/* Show rest only if trade type selected */}
          {tradeType && (
            <>
              {/* Trade Reasons */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  İşlem Sebepleri
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STOP_REASONS.map((reason) => (
                    <label
                      key={reason.id}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                        reasons.includes(reason.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      <Checkbox
                        checked={reasons.includes(reason.id)}
                        onCheckedChange={() => toggleReason(reason.id)}
                      />
                      <span className="text-sm text-foreground">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Alış Fiyatı (Entry)
                  </label>
                  <NumberInput
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className={cn('font-mono', hasNegativeEntry && 'border-loss focus-visible:ring-loss')}
                  />
                  {hasNegativeEntry && (
                    <p className="text-xs text-loss mt-1">⚠️ Fiyat sıfırdan büyük olmalı</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Hedef Fiyatı (Target)
                  </label>
                  <NumberInput
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className={cn('font-mono', hasNegativeTarget && 'border-loss focus-visible:ring-loss')}
                  />
                  {hasNegativeTarget && (
                    <p className="text-xs text-loss mt-1">⚠️ Fiyat sıfırdan büyük olmalı</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Stop Fiyatı (Stop)
                  </label>
                  <NumberInput
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    className={cn('font-mono', (hasNegativeStop || hasEntryStopError) && 'border-loss focus-visible:ring-loss')}
                  />
                  {hasNegativeStop && (
                    <p className="text-xs text-loss mt-1">⚠️ Fiyat sıfırdan büyük olmalı</p>
                  )}
                  {hasEntryStopError && !hasNegativeStop && (
                    <p className="text-xs text-loss mt-1">⚠️ Stop fiyatı Entry fiyatından farklı olmalı</p>
                  )}
                </div>
              </div>

              {/* Position Amount (Optional) */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  İşlem Tutarı (₺) - Opsiyonel
                </label>
                <NumberInput
                  step="1"
                  min="1"
                  placeholder="Örn: 10000"
                  value={positionAmount}
                  onChange={(e) => setPositionAmount(e.target.value)}
                  className={cn('font-mono', hasNegativePosition && 'border-loss focus-visible:ring-loss')}
                />
                {hasNegativePosition && (
                  <p className="text-xs text-loss mt-1">⚠️ Tutar sıfırdan büyük olmalı</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Equity grafiği için işleme giren para miktarını girin
                </p>
              </div>

              {/* RR Display */}
              <div className="pt-2 pb-8">
                {rrRatio !== null && (
                  <div
                    className={cn(
                      'p-4 rounded-lg border text-center mb-4',
                      rrRatio >= 3
                        ? 'border-profit/50 bg-profit/10'
                        : 'border-loss/50 bg-loss/10'
                    )}
                  >
                    <div className="text-sm text-muted-foreground mb-1">
                      Risk/Reward Oranı
                    </div>
                    <div
                      className={cn(
                        'text-2xl font-bold font-mono',
                        rrRatio >= 3 ? 'text-profit' : 'text-loss'
                      )}
                    >
                      {rrRatio.toFixed(2)} RR
                    </div>
                    <div
                      className={cn(
                        'text-xs mt-1',
                        rrRatio >= 3 ? 'text-profit' : 'text-loss'
                      )}
                    >
                      {rrRatio >= 3 ? '✅ İyi oran' : '⚠️ Düşük oran'}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background-secondary border-t border-border p-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button
            variant={tradeType === 'sell' ? 'sell' : 'buy'}
            className="flex-1"
            onClick={handleSave}
            disabled={!isValid || isSubmitting || isSubmittingLocal}
          >
            {(isSubmitting || isSubmittingLocal) ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}
