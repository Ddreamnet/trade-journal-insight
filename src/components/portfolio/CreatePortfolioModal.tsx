import { useState } from 'react';
import { FolderPlus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePortfolios } from '@/hooks/usePortfolios';
import { usePortfolioContext } from '@/contexts/PortfolioContext';

interface CreatePortfolioModalProps {
  open: boolean;
  onClose: () => void;
  /** Modal'ın neden açıldığını açıklayan opsiyonel hint */
  hint?: string;
  /** Oluşturulan portföyün id'sini döner */
  onCreated?: (portfolioId: string) => void;
  /** Oluşturulunca context'teki aktif seçimi güncelle */
  autoActivate?: boolean;
}

export function CreatePortfolioModal({
  open,
  onClose,
  hint,
  onCreated,
  autoActivate = true,
}: CreatePortfolioModalProps) {
  const { createPortfolio } = usePortfolios();
  const { setActiveSelection } = usePortfolioContext();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const trimmed = name.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= 60;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const portfolio = await createPortfolio.mutateAsync({ name: trimmed });
      if (autoActivate) setActiveSelection(portfolio.id);
      onCreated?.(portfolio.id);
      setName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Portföy Hesabı Aç</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {hint && (
            <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">{hint}</p>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Portföy Adı
            </label>
            <Input
              autoFocus
              placeholder="Örn: Uzun Vadeli, Kısa Vadeli, Deneme..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Portföyler işlemlerinizi, nakit hareketlerinizi ve raporlarınızı ayırmanıza yarar.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              İptal
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={!isValid || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                'Oluştur'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
