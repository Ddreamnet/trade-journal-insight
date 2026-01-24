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
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
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
              'px-3 py-2 rounded-lg bg-card border border-border transition-all',
              highlightedTradeId === trade.id && 'highlight-new'
            )}
          >
            {/* Compact Row Layout */}
            <div className="flex items-center gap-3">
              {/* Type Icon */}
              <div
                className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                  trade.trade_type === 'buy' ? 'bg-profit/20' : 'bg-loss/20'
                )}
              >
                {trade.trade_type === 'buy' ? (
                  <TrendingUp className="w-4 h-4 text-profit" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-loss" />
                )}
              </div>

              {/* Stock Info */}
              <div className="min-w-0 flex-shrink-0 w-20">
                <div className="font-semibold text-sm text-foreground truncate">{trade.stock_symbol}</div>
                <div className="text-xs text-muted-foreground truncate">{trade.stock_name}</div>
              </div>

              {/* Price Grid - Compact */}
              <div className="flex-1 grid grid-cols-4 gap-1 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">Entry</div>
                  <div className="font-mono text-xs text-foreground">₺{trade.entry_price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Target</div>
                  <div className="font-mono text-xs text-foreground">₺{trade.target_price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Stop</div>
                  <div className="font-mono text-xs text-foreground">₺{trade.stop_price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">RR</div>
                  <div
                    className={cn(
                      'font-mono text-xs font-semibold',
                      (trade.rr_ratio ?? 0) >= 3 ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {(trade.rr_ratio ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Closed trade: Exit + Result */}
              {type === 'closed' && trade.exit_price && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">Exit</div>
                    <div className="font-mono text-xs text-foreground">₺{trade.exit_price.toFixed(2)}</div>
                  </div>
                  <div
                    className={cn(
                      'px-2 py-1 rounded text-xs font-semibold',
                      trade.is_successful ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                    )}
                  >
                    {trade.is_successful ? '✅' : '❌'}
                  </div>
                </div>
              )}

              {/* Action Button */}
              {type === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 h-7 text-xs px-2"
                  onClick={() => setClosingTrade(trade)}
                >
                  <X className="w-3 h-3 mr-1" />
                  Kapat
                </Button>
              )}
            </div>

            {/* Reasons - Collapsible line */}
            {trade.reasons.length > 0 && (
              <div className="text-[10px] text-muted-foreground mt-1 ml-11 truncate">
                <span className="font-medium">Sebepler:</span> {getReasonLabels(trade.reasons)}
              </div>
            )}
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
