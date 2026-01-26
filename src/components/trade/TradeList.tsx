import { useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trade, TRADE_REASONS } from '@/types/trade';
import { CloseTradeModal } from './CloseTradeModal';
import { useYahooFinance } from '@/hooks/useYahooFinance';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TradeListProps {
  trades: Trade[];
  type: 'active' | 'closed';
  onCloseTrade?: (tradeId: string, exitPrice: number) => void;
  highlightedTradeId?: string | null;
  isLoading?: boolean;
}

export function TradeList({ trades, type, onCloseTrade, highlightedTradeId, isLoading = false }: TradeListProps) {
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const { getLastPrice } = useYahooFinance();

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

  // Helper to render current price with change indicator
  const renderCurrentPrice = (symbol: string, entryPrice: number) => {
    const currentPrice = getLastPrice(symbol);
    
    if (currentPrice === null) {
      return <span className="font-mono text-sm text-muted-foreground">—</span>;
    }

    const diff = currentPrice - entryPrice;
    const isPositive = diff >= 0;

    return (
      <div className="flex flex-col items-center">
        <span className="font-mono text-sm text-foreground">₺{currentPrice.toFixed(2)}</span>
        <span className={cn(
          "text-[10px] font-medium",
          isPositive ? "text-profit" : "text-loss"
        )}>
          {isPositive ? '+' : ''}{diff.toFixed(2)}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-xl bg-card border border-border">
        {type === 'active' ? 'Aktif işlem bulunmuyor' : 'Kapalı işlem bulunmuyor'}
      </div>
    );
  }

  // Desktop table view
  const DesktopTable = () => (
    <div className="hidden md:block rounded-xl bg-card border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-medium">Hisse</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Anlık</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Tür</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Entry</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Target</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Stop</TableHead>
            <TableHead className="text-muted-foreground font-medium">Sebepler</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">RR</TableHead>
            {type === 'closed' && (
              <>
                <TableHead className="text-muted-foreground font-medium text-center">Exit</TableHead>
                <TableHead className="text-muted-foreground font-medium text-center">Sonuç</TableHead>
              </>
            )}
            {type === 'active' && (
              <TableHead className="text-muted-foreground font-medium text-center">İşlem</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow
              key={trade.id}
              className={cn(
                'border-border transition-all',
                highlightedTradeId === trade.id && 'highlight-new bg-primary/10'
              )}
            >
              {/* Hisse */}
              <TableCell className="py-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      trade.trade_type === 'buy' ? 'bg-profit/20' : 'bg-loss/20'
                    )}
                  >
                    {trade.trade_type === 'buy' ? (
                      <TrendingUp className="w-4 h-4 text-profit" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{trade.stock_symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[80px]">{trade.stock_name}</div>
                  </div>
                </div>
              </TableCell>

              {/* Anlık Fiyat */}
              <TableCell className="text-center">
                {renderCurrentPrice(trade.stock_symbol, trade.entry_price)}
              </TableCell>

              {/* İşlem Türü */}
              <TableCell className="text-center">
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    trade.trade_type === 'buy'
                      ? 'bg-profit/20 text-profit'
                      : 'bg-loss/20 text-loss'
                  )}
                >
                  {trade.trade_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                </span>
              </TableCell>

              {/* Entry */}
              <TableCell className="text-center">
                <span className="font-mono text-sm text-foreground">₺{trade.entry_price.toFixed(2)}</span>
              </TableCell>

              {/* Target */}
              <TableCell className="text-center">
                <span className="font-mono text-sm text-foreground">₺{trade.target_price.toFixed(2)}</span>
              </TableCell>

              {/* Stop */}
              <TableCell className="text-center">
                <span className="font-mono text-sm text-foreground">₺{trade.stop_price.toFixed(2)}</span>
              </TableCell>

              {/* Sebepler */}
              <TableCell className="max-w-[150px]">
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {getReasonLabels(trade.reasons)}
                </span>
              </TableCell>

              {/* RR */}
              <TableCell className="text-center">
                <span
                  className={cn(
                    'font-mono text-sm font-semibold px-2 py-1 rounded-md',
                    (trade.rr_ratio ?? 0) >= 3 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                  )}
                >
                  {(trade.rr_ratio ?? 0).toFixed(2)}
                </span>
              </TableCell>

              {/* Closed trade columns */}
              {type === 'closed' && (
                <>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm text-foreground">
                      {trade.exit_price ? `₺${trade.exit_price.toFixed(2)}` : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-1 rounded-full',
                        trade.is_successful ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                      )}
                    >
                      {trade.is_successful ? '✅ Başarılı' : '❌ Başarısız'}
                    </span>
                  </TableCell>
                </>
              )}

              {/* Action */}
              {type === 'active' && (
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setClosingTrade(trade)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Kapat
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // Mobile card-row view
  const MobileList = () => (
    <div className="md:hidden space-y-2">
      {trades.map((trade) => {
        const currentPrice = getLastPrice(trade.stock_symbol);
        
        return (
          <div
            key={trade.id}
            className={cn(
              'p-3 rounded-xl bg-card border border-border transition-all',
              highlightedTradeId === trade.id && 'highlight-new bg-primary/10'
            )}
          >
            {/* Row 1: Hisse + Tür + RR */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    trade.trade_type === 'buy' ? 'bg-profit/20' : 'bg-loss/20'
                  )}
                >
                  {trade.trade_type === 'buy' ? (
                    <TrendingUp className="w-4 h-4 text-profit" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-loss" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{trade.stock_symbol}</div>
                  <div className="text-xs text-muted-foreground">{trade.stock_name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    trade.trade_type === 'buy'
                      ? 'bg-profit/20 text-profit'
                      : 'bg-loss/20 text-loss'
                  )}
                >
                  {trade.trade_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                </span>
                <span
                  className={cn(
                    'font-mono text-sm font-semibold px-2 py-1 rounded-md',
                    (trade.rr_ratio ?? 0) >= 3 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                  )}
                >
                  RR {(trade.rr_ratio ?? 0).toFixed(1)}
                </span>
              </div>
            </div>

            {/* Row 2: Fiyatlar grid - now includes Anlık */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Anlık</div>
                <div className="font-mono text-xs text-foreground">
                  {currentPrice !== null ? `₺${currentPrice.toFixed(2)}` : '—'}
                </div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Entry</div>
                <div className="font-mono text-xs text-foreground">₺{trade.entry_price.toFixed(2)}</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Target</div>
                <div className="font-mono text-xs text-foreground">₺{trade.target_price.toFixed(2)}</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Stop</div>
                <div className="font-mono text-xs text-foreground">₺{trade.stop_price.toFixed(2)}</div>
              </div>
            </div>

            {/* Closed trade: Exit + Sonuç */}
            {type === 'closed' && trade.exit_price && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                  <div className="text-[10px] text-muted-foreground uppercase">Exit</div>
                  <div className="font-mono text-xs text-foreground">₺{trade.exit_price.toFixed(2)}</div>
                </div>
                <div
                  className={cn(
                    'text-center p-1.5 rounded-lg',
                    trade.is_successful ? 'bg-profit/20' : 'bg-loss/20'
                  )}
                >
                  <div className="text-[10px] text-muted-foreground uppercase">Sonuç</div>
                  <div
                    className={cn(
                      'text-xs font-semibold',
                      trade.is_successful ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {trade.is_successful ? '✅ Başarılı' : '❌ Başarısız'}
                  </div>
                </div>
              </div>
            )}

            {/* Row 3: Sebepler */}
            <div className="text-[10px] text-muted-foreground mb-2 line-clamp-1">
              <span className="font-medium">Sebepler:</span> {getReasonLabels(trade.reasons)}
            </div>

            {/* Action button */}
            {type === 'active' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => setClosingTrade(trade)}
              >
                <X className="w-3 h-3 mr-1" />
                İşlemi Kapat
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <DesktopTable />
      <MobileList />

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
