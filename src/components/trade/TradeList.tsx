import { useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trade, TRADE_REASONS } from '@/types/trade';
import { CloseTradeModal } from './CloseTradeModal';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface TradeListProps {
  trades: Trade[];
  type: 'active' | 'closed';
  onCloseTrade?: (tradeId: string, exitPrice: number) => void;
  highlightedTradeId?: string | null;
  isLoading?: boolean;
}

export function TradeList({ trades, type, onCloseTrade, highlightedTradeId, isLoading = false }: TradeListProps) {
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);

  const handleCloseConfirm = (exitPrice: number) => {
    if (closingTrade && onCloseTrade) {
      onCloseTrade(closingTrade.id, exitPrice);
      setClosingTrade(null);
    }
  };

  const getReasonLabels = (reasonIds: string[]) => {
    return reasonIds
      .map((id) => TRADE_REASONS.find((r) => r.id === id)?.label || id)
      .join(', ');
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {type === 'active' ? 'Aktif işlem bulunmuyor' : 'Kapalı işlem bulunmuyor'}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className={cn(
              'p-3 rounded-lg bg-card border border-border transition-all',
              highlightedTradeId === trade.id && 'highlight-new'
            )}
          >
            {/* Compact Header Row */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                  trade.trade_type === 'buy' ? 'bg-profit/20' : 'bg-loss/20'
                )}
              >
                {trade.trade_type === 'buy' ? (
                  <TrendingUp className="w-4 h-4 text-profit" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-loss" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{trade.stock_symbol}</span>
                  <span className="text-xs text-muted-foreground truncate">{trade.stock_name}</span>
                </div>
              </div>
              <div
                className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                  trade.trade_type === 'buy'
                    ? 'bg-profit/20 text-profit'
                    : 'bg-loss/20 text-loss'
                )}
              >
                {trade.trade_type === 'buy' ? 'AL' : 'SAT'}
              </div>
              <div
                className={cn(
                  'text-xs font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
                  (trade.rr_ratio ?? 0) >= 3 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                )}
              >
                {(trade.rr_ratio ?? 0).toFixed(1)}RR
              </div>
            </div>

            {/* Compact Price Row */}
            <div className="flex items-center gap-1 text-[11px] mb-2">
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary">
                <span className="text-muted-foreground">E:</span>
                <span className="font-mono text-foreground">₺{trade.entry_price.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary">
                <span className="text-muted-foreground">T:</span>
                <span className="font-mono text-foreground">₺{trade.target_price.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary">
                <span className="text-muted-foreground">S:</span>
                <span className="font-mono text-foreground">₺{trade.stop_price.toFixed(2)}</span>
              </div>
              
              {/* Closed trade: Exit price */}
              {type === 'closed' && trade.exit_price && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary">
                  <span className="text-muted-foreground">X:</span>
                  <span className="font-mono text-foreground">₺{trade.exit_price.toFixed(2)}</span>
                </div>
              )}
              
              {/* Closed trade: Result badge */}
              {type === 'closed' && (
                <div
                  className={cn(
                    'ml-auto px-2 py-1 rounded text-[10px] font-medium',
                    trade.is_successful ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                  )}
                >
                  {trade.is_successful ? '✅ Başarılı' : '❌ Başarısız'}
                </div>
              )}
            </div>

            {/* Reasons - single line, truncated */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 text-[10px] text-muted-foreground truncate">
                {getReasonLabels(trade.reasons)}
              </div>
              
              {/* Actions */}
              {type === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2 flex-shrink-0"
                  onClick={() => setClosingTrade(trade)}
                >
                  <X className="w-3 h-3 mr-1" />
                  Kapat
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Close Trade Modal */}
      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onConfirm={handleCloseConfirm}
        />
      )}
    </>
  );
}
