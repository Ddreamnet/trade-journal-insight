import { useState } from 'react';
import { X, Layers, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Trade, ClosingType } from '@/types/trade';
import { CloseTradeModal } from './CloseTradeModal';
import { TradeUpdateData } from './EditTradeModal';
import { ActiveTradeActionDialog } from './ActiveTradeActionDialog';
import { ClosedTradeActionDialog } from './ClosedTradeActionDialog';
import { ActivePositionCard } from './ActivePositionCard';
import { ClosedPositionCard } from './ClosedPositionCard';
import { ActiveStockCell, MergedClosedStockCell } from './TradeStockCell';
import { TradeNotesDialog } from './TradeNotesDialog';

import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';
import { getReasonLabelsList, getClosedRR } from '@/lib/tradeUtils';
import { MergedClosedTrade } from '@/lib/tradeMerge';

interface TradeListProps {
  trades?: Trade[];
  mergedClosedTrades?: MergedClosedTrade[];
  type: 'active' | 'closed';
  onCloseTrade?: (tradeId: string, exitPrice: number, closingType: ClosingType, lotQuantity: number, stopReason?: string, closingNote?: string) => void;
  onUpdateTrade?: (tradeId: string, data: TradeUpdateData) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onRevertClose?: (entryId: string, tradeId: string) => void;
  onDeleteClosedTrade?: (entryId: string, tradeId: string) => void;
  highlightedTradeId?: string | null;
  isLoading?: boolean;
}

export function TradeList({
  trades = [],
  mergedClosedTrades = [],
  type,
  onCloseTrade,
  onUpdateTrade,
  onDeleteTrade,
  onRevertClose,
  onDeleteClosedTrade,
  highlightedTradeId,
  isLoading = false,
}: TradeListProps) {
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [closedActionMerged, setClosedActionMerged] = useState<MergedClosedTrade | null>(null);
  const [confirmAction, setConfirmAction] = useState<'revert' | 'delete' | null>(null);
  const { getStockBySymbol } = useMarketData();

  const handleCloseConfirm = (
    exitPrice: number,
    closingType: ClosingType,
    lotQuantity: number,
    stopReason?: string,
    closingNote?: string
  ) => {
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
    if (!closedActionMerged || !confirmAction) return;
    const latestPartial = closedActionMerged.partial_closes.at(-1);
    if (!latestPartial) {
      setConfirmAction(null);
      setClosedActionMerged(null);
      return;
    }
    if (confirmAction === 'revert' && onRevertClose) {
      onRevertClose(latestPartial.id, latestPartial.trade_id);
    } else if (confirmAction === 'delete' && onDeleteClosedTrade) {
      onDeleteClosedTrade(latestPartial.id, latestPartial.trade_id);
    }
    setConfirmAction(null);
    setClosedActionMerged(null);
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

  // ─────── Loading / empty states ────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const itemCount = type === 'closed' ? mergedClosedTrades.length : trades.length;

  if (itemCount === 0) {
    return (
      <div className="rounded-xl surface-1 p-8 text-center">
        <p className="text-body text-foreground">
          {type === 'active' ? 'Açık pozisyon yok' : 'Kapalı işlem yok'}
        </p>
        <p className="text-label text-muted-foreground mt-1">
          {type === 'active'
            ? 'Alttaki + butonuyla ilk işleminizi ekleyin.'
            : 'Kapattığınız işlemler burada birikir.'}
        </p>
      </div>
    );
  }

  // ─────── Shared desktop-only helpers ───────────────────────────

  const RRBadge = ({
    trade,
    compact = false,
  }: {
    trade: { trade_type: string; entry_price: number; exit_price?: number | null; stop_price: number; rr_ratio?: number | null };
    compact?: boolean;
  }) => {
    const rr = type === 'closed' ? (getClosedRR(trade) ?? trade.rr_ratio ?? 0) : (trade.rr_ratio ?? 0);
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 h-6 rounded-md num-sm',
          rr >= 3 ? 'bg-profit-soft text-profit' : 'bg-loss-soft text-loss'
        )}
      >
        {compact ? `RR ${rr.toFixed(1)}` : rr.toFixed(2)}
      </span>
    );
  };

  const TypeBadge = ({ tradeType }: { tradeType: string }) => (
    <span
      className={cn(
        'text-caption px-1.5 py-0.5 rounded',
        tradeType === 'buy' ? 'bg-profit-soft text-profit' : 'bg-loss-soft text-loss'
      )}
    >
      {tradeType === 'buy' ? 'ALIŞ' : 'SATIŞ'}
    </span>
  );

  const ClosingBadge = ({ closing }: { closing: 'kar_al' | 'stop' | 'mixed' }) => {
    const label = closing === 'kar_al' ? 'Kâr Al' : closing === 'stop' ? 'Stop' : 'Karışık';
    const cls =
      closing === 'kar_al'
        ? 'bg-profit-soft text-profit'
        : closing === 'stop'
        ? 'bg-loss-soft text-loss'
        : 'bg-surface-3 text-muted-foreground';
    return <span className={cn('text-caption px-1.5 py-0.5 rounded', cls)}>{label}</span>;
  };

  const MergedRRBadge = ({ rr, compact = false }: { rr: number | null; compact?: boolean }) => {
    if (rr === null) return <span className="text-caption text-muted-foreground">—</span>;
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 h-6 rounded-md num-sm',
          rr >= 3 ? 'bg-profit-soft text-profit' : 'bg-loss-soft text-loss'
        )}
      >
        {compact ? `RR ${rr.toFixed(1)}` : rr.toFixed(2)}
      </span>
    );
  };

  const PartCountBadge = ({ count, variant }: { count: number; variant: 'parts' | 'merges' }) => (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-caption px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground'
      )}
      title={variant === 'parts' ? 'Parçalı kapatma sayısı' : 'Birleşmiş işlem sayısı'}
    >
      {variant === 'parts' ? <Scissors className="w-2.5 h-2.5" /> : <Layers className="w-2.5 h-2.5" />}
      {count}
    </span>
  );

  // ─────── Desktop: active ───────────────────────────────────────

  const DesktopActiveTable = () => (
    <div className="hidden md:block rounded-xl surface-1 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border-subtle hover:bg-transparent">
            <TableHead className="text-caption text-muted-foreground">Hisse</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Tür</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Lot</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Giriş</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Anlık</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Hedef</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Stop</TableHead>
            <TableHead className="text-caption text-muted-foreground">Sebepler</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">RR</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">İşlem</TableHead>
            <TableHead className="w-10 px-1"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const priceInfo = getCurrentPriceInfo(trade);
            return (
              <TableRow
                key={trade.id}
                className={cn(
                  'border-border-subtle transition-colors',
                  highlightedTradeId === trade.id && 'highlight-new bg-primary/10'
                )}
              >
                <TableCell className="py-3">
                  <ActiveStockCell trade={trade} showLotWarning onClick={setEditingTrade} />
                </TableCell>
                <TableCell className="text-center">
                  <TypeBadge tradeType={trade.trade_type} />
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={cn(
                      'num',
                      trade.remaining_lot < trade.lot_quantity
                        ? 'text-warning font-semibold'
                        : 'text-foreground'
                    )}
                  >
                    {trade.remaining_lot}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="num text-foreground">
                    {formatPrice(trade.entry_price, trade.stock_symbol)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {priceInfo ? (
                    <div>
                      <div className="num text-foreground">
                        {formatPrice(priceInfo.currentPrice, trade.stock_symbol)}
                      </div>
                      <div
                        className={cn(
                          'text-caption font-mono font-semibold',
                          priceInfo.isPositive ? 'text-profit' : 'text-loss'
                        )}
                      >
                        {priceInfo.priceDiffPercent >= 0 ? '+' : ''}
                        {priceInfo.priceDiffPercent.toFixed(2)}%
                      </div>
                    </div>
                  ) : (
                    <span className="text-label text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className="num text-foreground">
                    {formatPrice(trade.target_price, trade.stock_symbol)}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="num text-foreground">
                    {formatPrice(trade.stop_price, trade.stock_symbol)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {getReasonLabelsList(trade.reasons).map((label, i) => (
                      <div key={i} className="text-label text-muted-foreground">
                        {label}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <RRBadge trade={trade} />
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setClosingTrade(trade)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Kapat
                  </Button>
                </TableCell>
                <TableCell className="py-1 pl-0 pr-2 w-10">
                  <TradeNotesDialog
                    symbol={trade.stock_symbol}
                    stopReason={trade.stop_reason}
                    closingNote={trade.closing_note}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // ─────── Mobile: active (new PositionCard) ─────────────────────

  const MobileActiveList = () => (
    <div className="md:hidden space-y-2">
      {trades.map((trade) => (
        <ActivePositionCard
          key={trade.id}
          trade={trade}
          onClick={setEditingTrade}
          highlighted={highlightedTradeId === trade.id}
        />
      ))}
    </div>
  );

  // ─────── Desktop: closed (merged) ──────────────────────────────

  const DesktopClosedTable = () => (
    <div className="hidden md:block rounded-xl surface-1 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border-subtle hover:bg-transparent">
            <TableHead className="text-caption text-muted-foreground">Hisse</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Tür</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Top. Lot</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Ort. Giriş</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Ort. Hedef</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Ort. Stop</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Ort. Çıkış</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">Sonuç</TableHead>
            <TableHead className="text-caption text-muted-foreground text-center">RR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mergedClosedTrades.map((m) => (
            <TableRow key={m.key} className="border-border-subtle transition-colors hover:bg-surface-2/40">
              <TableCell className="py-3">
                <MergedClosedStockCell merged={m} onClick={setClosedActionMerged} />
              </TableCell>
              <TableCell className="text-center">
                <TypeBadge tradeType={m.trade_type} />
              </TableCell>
              <TableCell className="text-center">
                <div className="inline-flex items-center justify-center gap-1.5">
                  <span className="num text-foreground">{m.total_lot}</span>
                  {m.partial_closes.length > 1 && <PartCountBadge count={m.partial_closes.length} variant="parts" />}
                  {m.source_trades.length > 1 && <PartCountBadge count={m.source_trades.length} variant="merges" />}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <span className="num text-foreground">{formatPrice(m.weighted_entry, m.stock_symbol)}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="num text-foreground">{formatPrice(m.weighted_target, m.stock_symbol)}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="num text-foreground">{formatPrice(m.weighted_stop, m.stock_symbol)}</span>
              </TableCell>
              <TableCell className="text-center">
                <span className="num text-foreground">{formatPrice(m.weighted_exit, m.stock_symbol)}</span>
              </TableCell>
              <TableCell className="text-center">
                <ClosingBadge closing={m.closing_type_dominant} />
              </TableCell>
              <TableCell className="text-center">
                <MergedRRBadge rr={m.weighted_rr} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // ─────── Mobile: closed (new ClosedPositionCard) ───────────────

  const MobileClosedList = () => (
    <div className="md:hidden space-y-2">
      {mergedClosedTrades.map((m) => (
        <ClosedPositionCard key={m.key} merged={m} onClick={setClosedActionMerged} />
      ))}
    </div>
  );

  // ─────── Render ────────────────────────────────────────────────

  return (
    <>
      {type === 'active' ? (
        <>
          <DesktopActiveTable />
          <MobileActiveList />
        </>
      ) : (
        <>
          <DesktopClosedTable />
          <MobileClosedList />
        </>
      )}

      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onConfirm={handleCloseConfirm}
        />
      )}

      <ActiveTradeActionDialog
        trade={editingTrade}
        onClose={() => setEditingTrade(null)}
        onSave={handleEditSave}
        onDelete={handleDelete}
        hasPartialCloses={
          editingTrade
            ? (editingTrade.remaining_lot ?? 0) < (editingTrade.lot_quantity ?? 0)
            : false
        }
      />

      <ClosedTradeActionDialog
        merged={closedActionMerged}
        confirmAction={confirmAction}
        onAction={setConfirmAction}
        onConfirm={handleConfirmAction}
        onClose={() => setClosedActionMerged(null)}
        onCancelConfirm={() => setConfirmAction(null)}
      />
    </>
  );
}
