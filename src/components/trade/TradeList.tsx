import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trade, ClosedTradeEntry, ClosingType } from '@/types/trade';
import { CloseTradeModal } from './CloseTradeModal';
import { EditTradeModal, TradeUpdateData } from './EditTradeModal';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { ActiveStockCell, ClosedStockCell, StaticStockCell } from './TradeStockCell';
import { TradeNotesDialog } from './TradeNotesDialog';
import { ClosedTradeActionDialog } from './ClosedTradeActionDialog';
import { getReasonLabelsList, getClosedRR } from '@/lib/tradeUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TradeListProps {
  trades?: Trade[];
  closedEntries?: ClosedTradeEntry[];
  type: 'active' | 'closed';
  onCloseTrade?: (tradeId: string, exitPrice: number, closingType: ClosingType, lotQuantity: number, stopReason?: string, closingNote?: string) => void;
  onUpdateTrade?: (tradeId: string, data: TradeUpdateData) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onRevertClose?: (entryId: string, tradeId: string) => void;
  onDeleteClosedTrade?: (entryId: string, tradeId: string) => void;
  highlightedTradeId?: string | null;
  isLoading?: boolean;
}

export function TradeList({ trades = [], closedEntries = [], type, onCloseTrade, onUpdateTrade, onDeleteTrade, onRevertClose, onDeleteClosedTrade, highlightedTradeId, isLoading = false }: TradeListProps) {
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [closedActionEntry, setClosedActionEntry] = useState<ClosedTradeEntry | null>(null);
  const [confirmAction, setConfirmAction] = useState<'revert' | 'delete' | null>(null);
  const { getStockBySymbol } = useMarketData();

  const handleCloseConfirm = (exitPrice: number, closingType: ClosingType, lotQuantity: number, stopReason?: string, closingNote?: string) => {
    if (closingTrade && onCloseTrade) {
      onCloseTrade(closingTrade.id, exitPrice, closingType, lotQuantity, stopReason, closingNote);
      setClosingTrade(null);
    }
  };

  const handleEditSave = (tradeId: string, data: TradeUpdateData) => {
    if (onUpdateTrade) {
      onUpdateTrade(tradeId, data);
      setEditingTrade(null);
    }
  };

  const handleDelete = (tradeId: string) => {
    if (onDeleteTrade) {
      onDeleteTrade(tradeId);
      setEditingTrade(null);
    }
  };

  const handleConfirmAction = () => {
    if (!closedActionEntry || !confirmAction) return;
    if (confirmAction === 'revert' && onRevertClose) {
      onRevertClose(closedActionEntry.id, closedActionEntry.trade_id);
    } else if (confirmAction === 'delete' && onDeleteClosedTrade) {
      onDeleteClosedTrade(closedActionEntry.id, closedActionEntry.trade_id);
    }
    setConfirmAction(null);
    setClosedActionEntry(null);
  };

  const getCurrentPriceInfo = (trade: Trade) => {
    const marketStock = getStockBySymbol(trade.stock_symbol);
    if (!marketStock) return null;

    const currentPrice = marketStock.last;
    const priceDiff = currentPrice - trade.entry_price;
    const priceDiffPercent = (priceDiff / trade.entry_price) * 100;

    return {
      currentPrice,
      priceDiff,
      priceDiffPercent,
      isPositive: trade.trade_type === 'buy' ? priceDiff >= 0 : priceDiff <= 0,
    };
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

  const itemCount = type === 'closed' ? closedEntries.length : trades.length;

  if (itemCount === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-xl bg-card border border-border">
        {type === 'active' ? 'Aktif işlem bulunmuyor' : 'Kapalı işlem bulunmuyor'}
      </div>
    );
  }

  // Shared RR badge renderer
  const RRBadge = ({ trade, compact = false }: { trade: { trade_type: string; entry_price: number; exit_price?: number | null; stop_price: number; rr_ratio?: number | null }; compact?: boolean }) => {
    const rr = type === 'closed' ? (getClosedRR(trade) ?? trade.rr_ratio ?? 0) : (trade.rr_ratio ?? 0);
    return (
      <span
        className={cn(
          'font-mono text-sm font-semibold px-2 py-1 rounded-md',
          rr >= 3 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
        )}
      >
        {compact ? `RR ${rr.toFixed(1)}` : rr.toFixed(2)}
      </span>
    );
  };

  // Trade type badge
  const TypeBadge = ({ tradeType }: { tradeType: string }) => (
    <span
      className={cn(
        'text-xs font-medium px-2 py-1 rounded-full',
        tradeType === 'buy' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
      )}
    >
      {tradeType === 'buy' ? 'ALIŞ' : 'SATIŞ'}
    </span>
  );

  // Desktop table view for active trades
  const DesktopTable = () => (
    <div className="hidden md:block rounded-xl bg-card border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-medium">Hisse</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Tür</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Lot</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Giriş</TableHead>
            {type === 'active' && (
              <TableHead className="text-muted-foreground font-medium text-center">Anlık</TableHead>
            )}
            <TableHead className="text-muted-foreground font-medium text-center">Hedef</TableHead>
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
            <TableHead className="text-muted-foreground font-medium w-10 px-1"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const priceInfo = type === 'active' ? getCurrentPriceInfo(trade) : null;

            return (
              <TableRow
                key={trade.id}
                className={cn(
                  'border-border transition-all',
                  highlightedTradeId === trade.id && 'highlight-new bg-primary/10'
                )}
              >
                <TableCell className="py-3">
                  {type === 'active' ? (
                    <ActiveStockCell trade={trade} showLotWarning onClick={setEditingTrade} />
                  ) : (
                    <StaticStockCell symbol={trade.stock_symbol} name={trade.stock_name} tradeType={trade.trade_type} />
                  )}
                </TableCell>

                <TableCell className="text-center"><TypeBadge tradeType={trade.trade_type} /></TableCell>

                <TableCell className="text-center">
                  <span className={cn('font-mono text-sm', trade.remaining_lot < trade.lot_quantity ? 'text-warning font-semibold' : 'text-foreground')}>
                    {trade.remaining_lot}
                  </span>
                </TableCell>

                <TableCell className="text-center">
                  <span className="font-mono text-sm text-foreground">{formatPrice(trade.entry_price, trade.stock_symbol)}</span>
                </TableCell>

                {type === 'active' && (
                  <TableCell className="text-center">
                    {priceInfo ? (
                      <div>
                        <span className="font-mono text-sm text-foreground">{formatPrice(priceInfo.currentPrice, trade.stock_symbol)}</span>
                        <div className={cn('text-xs font-medium', priceInfo.isPositive ? 'text-profit' : 'text-loss')}>
                          {priceInfo.priceDiff >= 0 ? '+' : ''}{priceInfo.priceDiff.toFixed(2)} ({priceInfo.priceDiffPercent >= 0 ? '+' : ''}{priceInfo.priceDiffPercent.toFixed(2)}%)
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                )}

                <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{formatPrice(trade.target_price, trade.stock_symbol)}</span></TableCell>
                <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{formatPrice(trade.stop_price, trade.stock_symbol)}</span></TableCell>

                <TableCell>
                  <div className="space-y-0.5">
                    {getReasonLabelsList(trade.reasons).map((label, i) => (
                      <div key={i} className="text-xs text-muted-foreground">{label}</div>
                    ))}
                  </div>
                </TableCell>

                <TableCell className="text-center"><RRBadge trade={trade} /></TableCell>

                {type === 'closed' && (
                  <>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm text-foreground">{trade.exit_price ? formatPrice(trade.exit_price, trade.stock_symbol) : '-'}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', trade.closing_type === 'kar_al' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss')}>
                        {trade.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
                      </span>
                    </TableCell>
                  </>
                )}

                {type === 'active' && (
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setClosingTrade(trade)}>
                      <X className="w-3 h-3 mr-1" /> Kapat
                    </Button>
                  </TableCell>
                )}

                <TableCell className="py-1 pl-0 pr-2 w-10">
                  <div className="flex items-center gap-1">
                    <TradeNotesDialog symbol={trade.stock_symbol} stopReason={trade.stop_reason} closingNote={trade.closing_note} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // Mobile card-row view
  const MobileList = () => (
    <div className="md:hidden space-y-2">
      {trades.map((trade) => {
        const priceInfo = type === 'active' ? getCurrentPriceInfo(trade) : null;

        return (
          <div
            key={trade.id}
            className={cn(
              'p-3 rounded-xl bg-card border border-border transition-all',
              highlightedTradeId === trade.id && 'highlight-new bg-primary/10'
            )}
          >
            {/* Row 1: Hisse + Tür + RR + Icons */}
            <div className="flex items-center justify-between mb-2">
              {type === 'active' ? (
                <ActiveStockCell trade={trade} showLotWarning onClick={setEditingTrade} />
              ) : (
                <StaticStockCell symbol={trade.stock_symbol} name={trade.stock_name} tradeType={trade.trade_type} />
              )}
              <div className="flex items-center gap-2">
                <TypeBadge tradeType={trade.trade_type} />
                <RRBadge trade={trade} compact />
                <TradeNotesDialog symbol={trade.stock_symbol} stopReason={trade.stop_reason} closingNote={trade.closing_note} />
              </div>
            </div>

            {/* Row 2: Fiyatlar grid */}
            <div className={cn('grid gap-2 mb-2', type === 'active' ? 'grid-cols-5' : 'grid-cols-3')}>
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Giriş</div>
                <div className="font-mono text-xs text-foreground">{formatPrice(trade.entry_price, trade.stock_symbol)}</div>
              </div>
              {type === 'active' && priceInfo && (
                <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                  <div className="text-[10px] text-muted-foreground uppercase">Anlık</div>
                  <div className="font-mono text-xs text-foreground">{formatPrice(priceInfo.currentPrice, trade.stock_symbol)}</div>
                  <div className={cn('text-[10px] font-medium', priceInfo.isPositive ? 'text-profit' : 'text-loss')}>
                    {priceInfo.priceDiffPercent >= 0 ? '+' : ''}{priceInfo.priceDiffPercent.toFixed(1)}%
                  </div>
                </div>
              )}
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Hedef</div>
                <div className="font-mono text-xs text-foreground">{formatPrice(trade.target_price, trade.stock_symbol)}</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Stop</div>
                <div className="font-mono text-xs text-foreground">{formatPrice(trade.stop_price, trade.stock_symbol)}</div>
              </div>
              {type === 'active' && (
                <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                  <div className="text-[10px] text-muted-foreground uppercase">Lot</div>
                  <div className={cn('font-mono text-xs', trade.remaining_lot < trade.lot_quantity ? 'text-warning font-semibold' : 'text-foreground')}>
                    {trade.remaining_lot}
                  </div>
                </div>
              )}
            </div>

            {/* Closed trade: Exit + Sonuç */}
            {type === 'closed' && trade.exit_price && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                  <div className="text-[10px] text-muted-foreground uppercase">Exit</div>
                  <div className="font-mono text-xs text-foreground">{formatPrice(trade.exit_price, trade.stock_symbol)}</div>
                </div>
                <div className={cn('text-center p-1.5 rounded-lg', trade.closing_type === 'kar_al' ? 'bg-profit/20' : 'bg-loss/20')}>
                  <div className="text-[10px] text-muted-foreground uppercase">Sonuç</div>
                  <span className={cn('text-xs font-semibold', trade.closing_type === 'kar_al' ? 'text-profit' : 'text-loss')}>
                    {trade.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
                  </span>
                </div>
              </div>
            )}

            {/* Row 3: Sebepler */}
            <div className="text-[10px] text-muted-foreground mb-2">
              <span className="font-medium">Sebepler:</span>
              {getReasonLabelsList(trade.reasons).map((label, i) => (
                <div key={i} className="ml-1">{label}</div>
              ))}
            </div>

            {/* Action button */}
            {type === 'active' && (
              <Button variant="outline" size="sm" className="w-full h-9" onClick={() => setClosingTrade(trade)}>
                <X className="w-3 h-3 mr-1" /> İşlemi Kapat
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );

  // Closed entries desktop table
  const ClosedEntriesDesktopTable = () => (
    <div className="hidden md:block rounded-xl bg-card border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-medium">Hisse</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Tür</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Giriş</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Hedef</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Stop</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Exit</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Lot</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Sonuç</TableHead>
            <TableHead className="text-muted-foreground font-medium">Sebepler</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">RR</TableHead>
            <TableHead className="text-muted-foreground font-medium w-10 px-1"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {closedEntries.map((entry) => (
            <TableRow key={entry.id} className="border-border transition-all">
              <TableCell className="py-3">
                <ClosedStockCell entry={entry} onClick={setClosedActionEntry} />
              </TableCell>
              <TableCell className="text-center"><TypeBadge tradeType={entry.trade_type} /></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{formatPrice(entry.entry_price, entry.stock_symbol)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{formatPrice(entry.target_price, entry.stock_symbol)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{formatPrice(entry.stop_price, entry.stock_symbol)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{formatPrice(entry.exit_price, entry.stock_symbol)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{entry.lot_quantity}</span></TableCell>
              <TableCell className="text-center">
                <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', entry.closing_type === 'kar_al' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss')}>
                  {entry.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
                </span>
              </TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  {getReasonLabelsList(entry.reasons).map((label, i) => (
                    <div key={i} className="text-xs text-muted-foreground">{label}</div>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-center"><RRBadge trade={entry} /></TableCell>
              <TableCell className="py-1 pl-0 pr-2 w-10">
                <TradeNotesDialog symbol={entry.stock_symbol} stopReason={entry.stop_reason} closingNote={entry.closing_note} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // Closed entries mobile list
  const ClosedEntriesMobileList = () => (
    <div className="md:hidden space-y-2">
      {closedEntries.map((entry) => (
        <div key={entry.id} className="p-3 rounded-xl bg-card border border-border transition-all">
          <div className="flex items-center justify-between mb-2">
            <ClosedStockCell entry={entry} onClick={setClosedActionEntry} />
            <div className="flex items-center gap-2">
              <TypeBadge tradeType={entry.trade_type} />
              <RRBadge trade={entry} compact />
              <TradeNotesDialog symbol={entry.stock_symbol} stopReason={entry.stop_reason} closingNote={entry.closing_note} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Giriş</div>
              <div className="font-mono text-xs text-foreground">{formatPrice(entry.entry_price, entry.stock_symbol)}</div>
            </div>
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Hedef</div>
              <div className="font-mono text-xs text-foreground">{formatPrice(entry.target_price, entry.stock_symbol)}</div>
            </div>
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Stop</div>
              <div className="font-mono text-xs text-foreground">{formatPrice(entry.stop_price, entry.stock_symbol)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Exit</div>
              <div className="font-mono text-xs text-foreground">{formatPrice(entry.exit_price, entry.stock_symbol)}</div>
            </div>
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Lot</div>
              <div className="font-mono text-xs text-foreground">{entry.lot_quantity}</div>
            </div>
            <div className={cn('text-center p-1.5 rounded-lg', entry.closing_type === 'kar_al' ? 'bg-profit/20' : 'bg-loss/20')}>
              <div className="text-[10px] text-muted-foreground uppercase">Sonuç</div>
              <span className={cn('text-xs font-semibold', entry.closing_type === 'kar_al' ? 'text-profit' : 'text-loss')}>
                {entry.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">
            <span className="font-medium">Sebepler:</span>
            {getReasonLabelsList(entry.reasons).map((label, i) => (
              <div key={i} className="ml-1">{label}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {type === 'closed' ? (
        <>
          <ClosedEntriesDesktopTable />
          <ClosedEntriesMobileList />
        </>
      ) : (
        <>
          <DesktopTable />
          <MobileList />
        </>
      )}

      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onConfirm={handleCloseConfirm}
        />
      )}

      {editingTrade && (
        <EditTradeModal
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSave={handleEditSave}
          onDelete={handleDelete}
        />
      )}

      <ClosedTradeActionDialog
        entry={closedActionEntry}
        confirmAction={confirmAction}
        onAction={setConfirmAction}
        onConfirm={handleConfirmAction}
        onClose={() => setClosedActionEntry(null)}
        onCancelConfirm={() => setConfirmAction(null)}
      />
    </>
  );
}
