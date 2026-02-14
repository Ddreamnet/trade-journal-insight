import { useState } from 'react';
import { TrendingUp, TrendingDown, X, StickyNote, Pencil, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trade, ClosedTradeEntry, TRADE_REASONS, STOP_REASONS, ClosingType } from '@/types/trade';
import { CloseTradeModal } from './CloseTradeModal';
import { EditTradeModal, TradeUpdateData } from './EditTradeModal';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  highlightedTradeId?: string | null;
  isLoading?: boolean;
}

export function TradeList({ trades = [], closedEntries = [], type, onCloseTrade, onUpdateTrade, onDeleteTrade, highlightedTradeId, isLoading = false }: TradeListProps) {
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
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

  const getReasonLabels = (reasonIds: string[]) => {
    return reasonIds
      .map((id) => TRADE_REASONS.find((r) => r.id === id)?.label || id)
      .join(', ');
  };

  const getStopReasonLabels = (stopReasonIds: string | null) => {
    if (!stopReasonIds) return null;
    return stopReasonIds.split(',')
      .map(id => STOP_REASONS.find((r) => r.id === id)?.label || id)
      .join(', ');
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
      isPositive: trade.trade_type === 'buy' ? priceDiff >= 0 : priceDiff <= 0
    };
  };

  // Notes Dialog Component
  const NotesDialog = ({ trade }: { trade: Trade }) => (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-secondary transition-colors" title="Notlar">
          <StickyNote className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{trade.stock_symbol} - Notlar</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {trade.stop_reason && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Stop Sebebi</div>
                <p className="text-sm text-foreground">{getStopReasonLabels(trade.stop_reason)}</p>
              </div>
            )}
            {trade.closing_note && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Not</div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{trade.closing_note}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

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

  // Desktop table view
  const DesktopTable = () => (
    <div className="hidden md:block rounded-xl bg-card border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-medium">Hisse</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Tür</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Entry</TableHead>
            {type === 'active' && (
              <TableHead className="text-muted-foreground font-medium text-center">Anlık</TableHead>
            )}
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
                      <div className="font-semibold text-foreground text-sm flex items-center gap-1">
                        {trade.stock_symbol}
                        {type === 'active' && trade.lot_quantity === 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="w-3 h-3 text-warning" />
                              </TooltipTrigger>
                              <TooltipContent>Lot bilgisi eksik</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[80px]">{trade.stock_name}</div>
                    </div>
                  </div>
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

                {/* Anlık Fiyat */}
                {type === 'active' && (
                  <TableCell className="text-center">
                    {priceInfo ? (
                      <div>
                        <span className="font-mono text-sm text-foreground">₺{priceInfo.currentPrice.toFixed(2)}</span>
                        <div
                          className={cn(
                            'text-xs font-medium',
                            priceInfo.isPositive ? 'text-profit' : 'text-loss'
                          )}
                        >
                          {priceInfo.priceDiff >= 0 ? '+' : ''}{priceInfo.priceDiff.toFixed(2)} ({priceInfo.priceDiffPercent >= 0 ? '+' : ''}{priceInfo.priceDiffPercent.toFixed(2)}%)
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                )}

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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground line-clamp-2 cursor-default">
                          {getReasonLabels(trade.reasons)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{getReasonLabels(trade.reasons)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                          trade.closing_type === 'kar_al' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                        )}
                      >
                        {trade.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
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

                {/* Edit + Note Icons */}
                <TableCell className="py-1 pl-0 pr-2 w-10">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingTrade(trade)}
                      className="p-1 rounded hover:bg-secondary transition-colors"
                      title="Düzenle"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                    {(trade.closing_note || trade.stop_reason) && (
                      <NotesDialog trade={trade} />
                    )}
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
                  <div className="font-semibold text-foreground text-sm flex items-center gap-1">
                    {trade.stock_symbol}
                    {type === 'active' && trade.lot_quantity === 0 && (
                      <AlertTriangle className="w-3 h-3 text-warning" />
                    )}
                  </div>
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
                {/* Edit + Note Icons */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setEditingTrade(trade)}
                    className="p-1 rounded hover:bg-secondary transition-colors"
                    title="Düzenle"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                  {(trade.closing_note || trade.stop_reason) && (
                    <NotesDialog trade={trade} />
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Fiyatlar grid */}
            <div className={cn('grid gap-2 mb-2', type === 'active' ? 'grid-cols-4' : 'grid-cols-3')}>
              <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                <div className="text-[10px] text-muted-foreground uppercase">Entry</div>
                <div className="font-mono text-xs text-foreground">₺{trade.entry_price.toFixed(2)}</div>
              </div>
              {type === 'active' && priceInfo && (
                <div className="text-center p-1.5 rounded-lg bg-secondary/50">
                  <div className="text-[10px] text-muted-foreground uppercase">Anlık</div>
                  <div className="font-mono text-xs text-foreground">₺{priceInfo.currentPrice.toFixed(2)}</div>
                  <div
                    className={cn(
                      'text-[10px] font-medium',
                      priceInfo.isPositive ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {priceInfo.priceDiffPercent >= 0 ? '+' : ''}{priceInfo.priceDiffPercent.toFixed(1)}%
                  </div>
                </div>
              )}
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
                    'text-center p-1.5 rounded-lg relative',
                    trade.closing_type === 'kar_al' ? 'bg-profit/20' : 'bg-loss/20'
                  )}
                >
                  <div className="text-[10px] text-muted-foreground uppercase">Sonuç</div>
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        trade.closing_type === 'kar_al' ? 'text-profit' : 'text-loss'
                      )}
                    >
                      {trade.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Row 3: Sebepler */}
            <div className="text-[10px] text-muted-foreground mb-2">
              <span className="font-medium">Sebepler:</span> {getReasonLabels(trade.reasons)}
            </div>

            {/* Action button */}
            {type === 'active' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9"
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

  // Closed entries desktop table
  const ClosedEntriesDesktopTable = () => (
    <div className="hidden md:block rounded-xl bg-card border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-medium">Hisse</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Tür</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Entry</TableHead>
            <TableHead className="text-muted-foreground font-medium text-center">Target</TableHead>
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
                <div className="flex items-center gap-2">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', entry.trade_type === 'buy' ? 'bg-profit/20' : 'bg-loss/20')}>
                    {entry.trade_type === 'buy' ? <TrendingUp className="w-4 h-4 text-profit" /> : <TrendingDown className="w-4 h-4 text-loss" />}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{entry.stock_symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[80px]">{entry.stock_name}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <span className={cn('text-xs font-medium px-2 py-1 rounded-full', entry.trade_type === 'buy' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss')}>
                  {entry.trade_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                </span>
              </TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">₺{entry.entry_price.toFixed(2)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">₺{entry.target_price.toFixed(2)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">₺{entry.stop_price.toFixed(2)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">₺{entry.exit_price.toFixed(2)}</span></TableCell>
              <TableCell className="text-center"><span className="font-mono text-sm text-foreground">{entry.lot_quantity}</span></TableCell>
              <TableCell className="text-center">
                <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', entry.closing_type === 'kar_al' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss')}>
                  {entry.closing_type === 'kar_al' ? 'Kâr Al' : 'Stop'}
                </span>
              </TableCell>
              <TableCell className="max-w-[150px]">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground line-clamp-2 cursor-default">{getReasonLabels(entry.reasons)}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs"><p>{getReasonLabels(entry.reasons)}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell className="text-center">
                <span className={cn('font-mono text-sm font-semibold px-2 py-1 rounded-md', (entry.rr_ratio ?? 0) >= 3 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss')}>
                  {(entry.rr_ratio ?? 0).toFixed(2)}
                </span>
              </TableCell>
              <TableCell className="py-1 pl-0 pr-2 w-10">
                {(entry.closing_note || entry.stop_reason) && (
                  <ClosedEntryNotesDialog entry={entry} />
                )}
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
          {/* Row 1: Hisse + Tür + RR + Note */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', entry.trade_type === 'buy' ? 'bg-profit/20' : 'bg-loss/20')}>
                {entry.trade_type === 'buy' ? <TrendingUp className="w-4 h-4 text-profit" /> : <TrendingDown className="w-4 h-4 text-loss" />}
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm">{entry.stock_symbol}</div>
                <div className="text-xs text-muted-foreground">{entry.stock_name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-medium px-2 py-1 rounded-full', entry.trade_type === 'buy' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss')}>
                {entry.trade_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
              </span>
              <span className={cn('font-mono text-sm font-semibold px-2 py-1 rounded-md', (entry.rr_ratio ?? 0) >= 3 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss')}>
                RR {(entry.rr_ratio ?? 0).toFixed(1)}
              </span>
              {(entry.closing_note || entry.stop_reason) && (
                <ClosedEntryNotesDialog entry={entry} />
              )}
            </div>
          </div>

          {/* Row 2: Fiyatlar grid */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Entry</div>
              <div className="font-mono text-xs text-foreground">₺{entry.entry_price.toFixed(2)}</div>
            </div>
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Target</div>
              <div className="font-mono text-xs text-foreground">₺{entry.target_price.toFixed(2)}</div>
            </div>
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Stop</div>
              <div className="font-mono text-xs text-foreground">₺{entry.stop_price.toFixed(2)}</div>
            </div>
          </div>

          {/* Exit + Lot + Sonuç */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center p-1.5 rounded-lg bg-secondary/50">
              <div className="text-[10px] text-muted-foreground uppercase">Exit</div>
              <div className="font-mono text-xs text-foreground">₺{entry.exit_price.toFixed(2)}</div>
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

          {/* Sebepler */}
          <div className="text-[10px] text-muted-foreground">
            <span className="font-medium">Sebepler:</span> {getReasonLabels(entry.reasons)}
          </div>
        </div>
      ))}
    </div>
  );

  // Notes Dialog for closed entries
  const ClosedEntryNotesDialog = ({ entry }: { entry: ClosedTradeEntry }) => (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-secondary transition-colors" title="Notlar">
          <StickyNote className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{entry.stock_symbol} - Notlar</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {entry.stop_reason && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Stop Sebebi</div>
                <p className="text-sm text-foreground">{getStopReasonLabels(entry.stop_reason)}</p>
              </div>
            )}
            {entry.closing_note && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Not</div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{entry.closing_note}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
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

      {/* Close Trade Modal */}
      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onConfirm={handleCloseConfirm}
        />
      )}

      {/* Edit Trade Modal */}
      {editingTrade && (
        <EditTradeModal
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSave={handleEditSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
