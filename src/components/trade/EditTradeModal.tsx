import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trade, TradeType, ClosingType } from '@/types/trade';
import { EditTradeForm } from './EditTradeForm';

export interface TradeUpdateData {
  trade_type: TradeType;
  entry_price: number;
  target_price: number;
  stop_price: number;
  reasons: string[];
  lot_quantity?: number;
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
  hasPartialCloses?: boolean;
}

export function EditTradeModal({
  trade,
  onClose,
  onSave,
  onDelete,
  isSubmitting = false,
  hasPartialCloses = false,
}: EditTradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fade-in flex flex-col">
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

        <EditTradeForm
          trade={trade}
          onSave={onSave}
          onDelete={onDelete}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          hasPartialCloses={hasPartialCloses}
          className="flex-1 min-h-0"
        />
      </div>
    </div>
  );
}
