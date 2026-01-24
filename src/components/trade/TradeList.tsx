import { useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trade, TRADE_REASONS } from '@/types/trade';
import { CloseTradeModal } from './CloseTradeModal';
import { cn } from '@/lib/utils';

interface TradeListProps {
  trades: Trade[];
  type: 'active' | 'closed';
  onCloseTrade?: (tradeId: string, exitPrice: number, progressPercent: number, result: 'success' | 'failure') => void;
  highlightedTradeId?: string | null;
}

export function TradeList({ trades, type, onCloseTrade, highlightedTradeId }: TradeListProps) {
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);

  const handleCloseConfirm = (exitPrice: number, progressPercent: number, result: 'success' | 'failure') => {
    if (closingTrade && onCloseTrade) {
      onCloseTrade(closingTrade.id, exitPrice, progressPercent, result);
      setClosingTrade(null);
    }
  };

  const getReasonLabels = (reasonIds: string[]) => {
    return reasonIds
      .map((id) => TRADE_REASONS.find((r) => r.id === id)?.label || id)
      .join(', ');
  };

  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {type === 'active' ? 'Aktif işlem bulunmuyor' : 'Kapalı işlem bulunmuyor'}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className={cn(
              'p-4 rounded-xl bg-card border border-border transition-all',
              highlightedTradeId === trade.id && 'highlight-new'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    trade.trade_type === 'buy' ? 'bg-profit/20' : 'bg-loss/20'
                  )}
                >
                  {trade.trade_type === 'buy' ? (
                    <TrendingUp className="w-5 h-5 text-profit" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-loss" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{trade.stock_symbol}</div>
                  <div className="text-sm text-muted-foreground">{trade.stock_name}</div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full inline-block',
                    trade.trade_type === 'buy'
                      ? 'bg-profit/20 text-profit'
                      : 'bg-loss/20 text-loss'
                  )}
                >
                  {trade.trade_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                </div>
              </div>
            </div>

            {/* Price Grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="p-2 rounded-lg bg-secondary text-center">
                <div className="text-xs text-muted-foreground">Entry</div>
                <div className="font-mono text-sm text-foreground">
                  ₺{trade.entry_price.toFixed(2)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-secondary text-center">
                <div className="text-xs text-muted-foreground">Target</div>
                <div className="font-mono text-sm text-foreground">
                  ₺{trade.target_price.toFixed(2)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-secondary text-center">
                <div className="text-xs text-muted-foreground">Stop</div>
                <div className="font-mono text-sm text-foreground">
                  ₺{trade.stop_price.toFixed(2)}
                </div>
              </div>
              <div
                className={cn(
                  'p-2 rounded-lg text-center',
                  trade.rr_ratio >= 3 ? 'bg-profit/20' : 'bg-loss/20'
                )}
              >
                <div className="text-xs text-muted-foreground">RR</div>
                <div
                  className={cn(
                    'font-mono text-sm font-semibold',
                    trade.rr_ratio >= 3 ? 'text-profit' : 'text-loss'
                  )}
                >
                  {trade.rr_ratio.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Closed trade extra info */}
            {type === 'closed' && trade.exit_price && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded-lg bg-secondary text-center">
                  <div className="text-xs text-muted-foreground">Exit</div>
                  <div className="font-mono text-sm text-foreground">
                    ₺{trade.exit_price.toFixed(2)}
                  </div>
                </div>
                <div
                  className={cn(
                    'p-2 rounded-lg text-center',
                    trade.result === 'success' ? 'bg-profit/20' : 'bg-loss/20'
                  )}
                >
                  <div className="text-xs text-muted-foreground">Sonuç</div>
                  <div
                    className={cn(
                      'text-sm font-semibold',
                      trade.result === 'success' ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {trade.result === 'success' ? '✅ Başarılı' : '❌ Başarısız'}
                  </div>
                </div>
              </div>
            )}

            {/* Reasons */}
            <div className="text-xs text-muted-foreground mb-3">
              <span className="font-medium">Sebepler:</span> {getReasonLabels(trade.reasons)}
            </div>

            {/* Actions */}
            {type === 'active' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setClosingTrade(trade)}
              >
                <X className="w-4 h-4 mr-2" />
                İşlemi Kapat
              </Button>
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
