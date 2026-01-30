import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, MinusCircle } from 'lucide-react';

interface CashFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'deposit' | 'withdraw';
  onSubmit: (amount: number, note?: string) => Promise<boolean>;
  maxWithdraw?: number;
}

export function CashFlowModal({ 
  open, 
  onOpenChange, 
  type, 
  onSubmit,
  maxWithdraw 
}: CashFlowModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDeposit = type === 'deposit';
  const title = isDeposit ? 'Nakit Ekle' : 'Nakit Çek';
  const Icon = isDeposit ? PlusCircle : MinusCircle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);
    const success = await onSubmit(numAmount, note || undefined);
    setIsSubmitting(false);

    if (success) {
      setAmount('');
      setNote('');
      onOpenChange(false);
    }
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    setAmount(cleaned);
  };

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount > 0 && (!maxWithdraw || type === 'deposit' || numAmount <= maxWithdraw);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Icon className={`w-5 h-5 ${isDeposit ? 'text-profit' : 'text-loss'}`} />
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isDeposit 
              ? 'Portföyünüze nakit ekleyin. Birim fiyat değişmez, pay sayısı artar.'
              : 'Portföyünüzden nakit çekin. Birim fiyat değişmez, pay sayısı azalır.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground">
              Tutar (₺)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₺</span>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="pl-8 font-mono text-lg"
                autoFocus
              />
            </div>
            {!isDeposit && maxWithdraw !== undefined && (
              <p className="text-xs text-muted-foreground">
                Maks. çekilebilir: <span className="font-mono text-foreground">₺{maxWithdraw.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="text-foreground">
              Not (opsiyonel)
            </Label>
            <Textarea
              id="note"
              placeholder="İşlem hakkında not..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className={`flex-1 ${isDeposit ? 'bg-profit hover:bg-profit/90' : 'bg-loss hover:bg-loss/90'} text-white`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  İşleniyor...
                </>
              ) : (
                title
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
