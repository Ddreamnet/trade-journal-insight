import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Checkbox } from '@/components/ui/checkbox';
import { StockLogo } from '@/components/ui/stock-logo';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetBody,
  BottomSheetFooter,
} from '@/components/ui/bottom-sheet';
import { Stock, TradeType, StopReason, STOP_REASONS } from '@/types/trade';
import { cn } from '@/lib/utils';
import { formatPrice, getCurrencySymbol, getSymbolCurrency } from '@/lib/currency';
import { validateDirectional, calculateRR, calculatePositionAmount } from '@/lib/tradeValidation';

interface TradeFormProps {
  stock: Stock & { logoUrl?: string; currency?: 'TRY' | 'USD' };
  portfolioName: string;
  onClose: () => void;
  onSave: (trade: {
    stock_symbol: string;
    stock_name: string;
    trade_type: 'buy' | 'sell';
    entry_price: number;
    target_price: number;
    stop_price: number;
    reasons: string[];
    lot_quantity?: number;
  }) => void;
  isSubmitting?: boolean;
}

/**
 * TradeForm — bottom-sheet for creating a new position.
 *
 * Step ordering (progressive disclosure):
 *   1. Trade type — AL / SAT (always visible)
 *   2. Everything else — only after trade type is chosen, so the user
 *      isn't overwhelmed with inputs on open.
 *
 * Entry / target / stop render as a 3-column row on all viewports — tight
 * but intentional, since they're directly related and users scan them as
 * a triad.
 */
export function TradeForm({
  stock,
  portfolioName,
  onClose,
  onSave,
  isSubmitting = false,
}: TradeFormProps) {
  const [tradeType, setTradeType] = useState<TradeType | null>(null);
  const [reasons, setReasons] = useState<StopReason[]>([]);
  const [entryPrice, setEntryPrice] = useState(stock.currentPrice.toString());
  const [targetPrice, setTargetPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [lotQuantity, setLotQuantity] = useState('');
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const parsedEntry = parseFloat(entryPrice);
  const parsedTarget = parseFloat(targetPrice);
  const parsedStop = parseFloat(stopPrice);
  const parsedLot = parseInt(lotQuantity, 10);

  const hasNegativeEntry = !isNaN(parsedEntry) && parsedEntry <= 0;
  const hasNegativeTarget = !isNaN(parsedTarget) && parsedTarget <= 0;
  const hasNegativeStop = !isNaN(parsedStop) && parsedStop <= 0;
  const hasAnyNegativeError = hasNegativeEntry || hasNegativeTarget || hasNegativeStop;

  const directionalErrors = useMemo(
    () => validateDirectional(tradeType, parsedEntry, parsedTarget, parsedStop),
    [tradeType, parsedEntry, parsedTarget, parsedStop]
  );

  const hasDirectionalError = directionalErrors.length > 0;

  const rrRatio = useMemo(
    () => calculateRR(tradeType, parsedEntry, parsedTarget, parsedStop, hasDirectionalError),
    [parsedEntry, parsedTarget, parsedStop, tradeType, hasDirectionalError]
  );

  const positionAmount = useMemo(
    () => calculatePositionAmount(parsedEntry, parsedLot),
    [parsedEntry, parsedLot]
  );

  const toggleReason = (reasonId: StopReason) => {
    setReasons((prev) =>
      prev.includes(reasonId) ? prev.filter((r) => r !== reasonId) : [...prev, reasonId]
    );
  };

  const handleSave = async () => {
    if (isSubmittingLocal || isSubmitting) return;
    if (!tradeType || !entryPrice || !targetPrice || !stopPrice) return;
    if (reasons.length === 0) return;
    if (hasAnyNegativeError || hasDirectionalError) return;

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
        lot_quantity: !isNaN(parsedLot) && parsedLot > 0 ? parsedLot : undefined,
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
    !hasAnyNegativeError &&
    !hasDirectionalError;

  const currency = stock.currency ?? getSymbolCurrency(stock.symbol);
  const currencySymbol = getCurrencySymbol(currency);

  return (
    <BottomSheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheetContent size="lg">
        {/* Custom header with stock context — replaces default title slot */}
        <div className="px-5 pt-2 pb-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <StockLogo symbol={stock.symbol} logoUrl={stock.logoUrl} size="md" />
              <div className="min-w-0">
                <div className="text-title text-foreground truncate">{stock.symbol}</div>
                <div className="text-label text-muted-foreground truncate">
                  {stock.name}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="num text-foreground">
                {formatPrice(stock.currentPrice, currency)}
              </div>
              <div
                className={cn(
                  'flex items-center justify-end gap-1 text-caption font-mono font-semibold',
                  stock.change >= 0 ? 'text-profit' : 'text-loss'
                )}
              >
                {stock.change >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {stock.change >= 0 ? '+' : ''}
                {stock.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        <BottomSheetBody className="space-y-5 pt-4">
          {/* Portfolio context */}
          <div className="flex items-center gap-2 p-3 rounded-lg surface-1">
            <Folder className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-caption text-muted-foreground">Portföy</div>
              <div className="text-body font-semibold text-foreground truncate">
                {portfolioName}
              </div>
            </div>
          </div>

          {/* Trade type */}
          <div>
            <label className="text-label text-muted-foreground mb-2 block">
              İşlem Türü
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={tradeType === 'buy' ? 'buy' : 'outline'}
                size="xl"
                onClick={() => setTradeType('buy')}
              >
                <TrendingUp className="w-5 h-5" />
                AL
              </Button>
              <Button
                type="button"
                variant={tradeType === 'sell' ? 'sell' : 'outline'}
                size="xl"
                onClick={() => setTradeType('sell')}
              >
                <TrendingDown className="w-5 h-5" />
                SAT
              </Button>
            </div>
          </div>

          {tradeType && (
            <>
              {/* Reasons */}
              <div>
                <label className="text-label text-muted-foreground mb-2 block">
                  İşlem Sebepleri
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STOP_REASONS.map((reason) => (
                    <label
                      key={reason.id}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                        reasons.includes(reason.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-border-subtle hover:border-border'
                      )}
                    >
                      <Checkbox
                        checked={reasons.includes(reason.id)}
                        onCheckedChange={() => toggleReason(reason.id)}
                      />
                      <span className="text-label text-foreground">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price triad */}
              <div className="grid grid-cols-3 gap-2">
                <PriceField
                  label="Giriş"
                  value={entryPrice}
                  onChange={setEntryPrice}
                  hasError={hasNegativeEntry}
                />
                <PriceField
                  label="Hedef"
                  value={targetPrice}
                  onChange={setTargetPrice}
                  hasError={hasNegativeTarget}
                />
                <PriceField
                  label="Stop"
                  value={stopPrice}
                  onChange={setStopPrice}
                  hasError={hasNegativeStop}
                />
              </div>

              {(hasAnyNegativeError || hasDirectionalError) && (
                <div className="space-y-1">
                  {hasAnyNegativeError && (
                    <p className="text-caption text-loss">
                      Fiyatlar sıfırdan büyük olmalı
                    </p>
                  )}
                  {directionalErrors.map((err, i) => (
                    <p key={i} className="text-caption text-loss">
                      {err}
                    </p>
                  ))}
                </div>
              )}

              {/* Lot */}
              <div>
                <label className="text-label text-muted-foreground mb-1.5 block">
                  Lot / Kağıt Adedi
                </label>
                <NumberInput
                  step="1"
                  min="1"
                  placeholder="Örn: 100"
                  value={lotQuantity}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setLotQuantity(val);
                  }}
                  className="font-mono h-11"
                />
                {positionAmount !== null && (
                  <p className="text-caption text-muted-foreground mt-1">
                    İşlem tutarı:{' '}
                    <span className="num-sm text-foreground">
                      {currencySymbol}
                      {positionAmount.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </p>
                )}
              </div>

              {/* RR preview */}
              {rrRatio !== null && (
                <div
                  className={cn(
                    'p-3 rounded-lg text-center',
                    rrRatio >= 3 ? 'bg-profit-soft' : 'bg-loss-soft'
                  )}
                >
                  <div className="text-caption text-muted-foreground">
                    Risk / Reward
                  </div>
                  <div
                    className={cn(
                      'num-display mt-0.5',
                      rrRatio >= 3 ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {rrRatio.toFixed(2)}
                  </div>
                  <div
                    className={cn(
                      'text-caption mt-0.5',
                      rrRatio >= 3 ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {rrRatio >= 3 ? 'İyi oran' : 'Düşük oran'}
                  </div>
                </div>
              )}
            </>
          )}
        </BottomSheetBody>

        <BottomSheetFooter>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button
            variant={tradeType === 'sell' ? 'sell' : 'buy'}
            className="flex-1"
            onClick={handleSave}
            disabled={!isValid || isSubmitting || isSubmittingLocal}
          >
            {(isSubmitting || isSubmittingLocal) ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function PriceField({
  label,
  value,
  onChange,
  hasError,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
}) {
  return (
    <div>
      <label className="text-caption text-muted-foreground mb-1.5 block">{label}</label>
      <NumberInput
        step="0.01"
        min="0.01"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('font-mono h-11 text-[0.9375rem]', hasError && 'border-loss focus-visible:ring-loss')}
      />
    </div>
  );
}
