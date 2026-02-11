import { useState } from 'react';
import { X, Plus, Minus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

interface CashFlowModalProps {
  onClose: () => void;
}

export function CashFlowModal({ onClose }: CashFlowModalProps) {
  const { cashFlows, availableCash, addDeposit, addWithdraw } = usePortfolioCash();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleDeposit = async () => {
    if (!isValidAmount || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDeposit.mutateAsync({ amount: parsedAmount, note: note.trim() || undefined });
      setAmount('');
      setNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!isValidAmount || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addWithdraw.mutateAsync({ amount: parsedAmount, note: note.trim() || undefined });
      setAmount('');
      setNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[90vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Portföy Nakit</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          {/* Available Cash */}
          <div className="mt-3 p-3 rounded-lg bg-secondary text-center">
            <div className="text-xs text-muted-foreground mb-1">Kullanılabilir Nakit</div>
            <div className="font-mono text-xl font-bold text-foreground">
              ₺{availableCash.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <Tabs defaultValue="deposit">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="deposit" className="gap-1">
                  <Plus className="w-3 h-3" /> Para Ekle
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="gap-1">
                  <Minus className="w-3 h-3" /> Para Çıkar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deposit" className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tutar (₺)</label>
                  <NumberInput
                    step="1"
                    min="1"
                    placeholder="Örn: 10000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Not (Opsiyonel)</label>
                  <Textarea
                    placeholder="Açıklama..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="resize-none h-16"
                    maxLength={200}
                  />
                </div>
                <Button className="w-full" onClick={handleDeposit} disabled={!isValidAmount || isSubmitting}>
                  {isSubmitting ? 'Ekleniyor...' : 'Para Ekle'}
                </Button>
              </TabsContent>

              <TabsContent value="withdraw" className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tutar (₺)</label>
                  <NumberInput
                    step="1"
                    min="1"
                    placeholder="Örn: 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Not (Opsiyonel)</label>
                  <Textarea
                    placeholder="Açıklama..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="resize-none h-16"
                    maxLength={200}
                  />
                </div>
                <Button variant="outline" className="w-full" onClick={handleWithdraw} disabled={!isValidAmount || isSubmitting}>
                  {isSubmitting ? 'Çekiliyor...' : 'Para Çıkar'}
                </Button>
              </TabsContent>
            </Tabs>

            {/* Transaction History */}
            {cashFlows.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Geçmiş İşlemler</h3>
                <div className="space-y-2">
                  {cashFlows.map((flow) => (
                    <div
                      key={flow.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center',
                          flow.flow_type === 'deposit' ? 'bg-profit/20' : 'bg-loss/20'
                        )}>
                          {flow.flow_type === 'deposit' ? (
                            <Plus className="w-3 h-3 text-profit" />
                          ) : (
                            <Minus className="w-3 h-3 text-loss" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm text-foreground">
                            {flow.flow_type === 'deposit' ? 'Para Ekleme' : 'Para Çekme'}
                          </div>
                          {flow.note && (
                            <div className="text-xs text-muted-foreground">{flow.note}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          'font-mono text-sm font-medium',
                          flow.flow_type === 'deposit' ? 'text-profit' : 'text-loss'
                        )}>
                          {flow.flow_type === 'deposit' ? '+' : '-'}₺{flow.amount.toLocaleString('tr-TR')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(flow.created_at), 'd MMM HH:mm', { locale: tr })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
