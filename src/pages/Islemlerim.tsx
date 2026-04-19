import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { Wallet, ArrowRightLeft, FolderPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StockSelector } from '@/components/trade/StockSelector';
import { TradeForm } from '@/components/trade/TradeForm';
import { TradeList } from '@/components/trade/TradeList';
import { CashFlowModal } from '@/components/trade/CashFlowModal';
import { ExchangeModal } from '@/components/trade/ExchangeModal';
import { MergeTradeDialog, MergeIncoming } from '@/components/trade/MergeTradeDialog';
import { CreatePortfolioModal } from '@/components/portfolio/CreatePortfolioModal';
import { Stock, ClosingType, Trade } from '@/types/trade';
import { TradeUpdateData } from '@/components/trade/EditTradeModal';
import { useTrades } from '@/hooks/useTrades';
import { usePortfolioContext } from '@/contexts/PortfolioContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Islemlerim() {
  const [isStockSelectorOpen, setIsStockSelectorOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<(Stock & { logoUrl?: string }) | null>(null);
  const [isCashFlowOpen, setIsCashFlowOpen] = useState(false);
  const [isExchangeOpen, setIsExchangeOpen] = useState(false);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState(false);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);
  const location = useLocation();
  const lastOpenAddTradeStamp = useRef<number | null>(null);
  const [mergePrompt, setMergePrompt] = useState<{
    candidates: Trade[];
    incoming: MergeIncoming;
  } | null>(null);

  const {
    activeTrades, mergedClosedTrades,
    createTrade, mergeIntoTrade, closeTrade, updateTrade, deleteTrade,
    revertPartialClose, deleteClosedTrade, isLoading,
  } = useTrades();

  const {
    activeSelection, activePortfolio, portfolios,
  } = usePortfolioContext();

  // Seçime göre işlem ve kısmi kapanış filtreleri
  const filteredActiveTrades = useMemo(() => {
    if (activeSelection === 'all' || activeSelection === null) return activeTrades;
    return (activeTrades as Trade[]).filter(t => t.portfolio_id === activeSelection);
  }, [activeTrades, activeSelection]);

  const filteredMergedClosed = useMemo(() => {
    if (activeSelection === 'all' || activeSelection === null) return mergedClosedTrades;
    return mergedClosedTrades.filter(e => e.portfolio_id === activeSelection);
  }, [mergedClosedTrades, activeSelection]);

  const hasNoPortfolio = portfolios.length === 0;

  const handleOpenStockSelector = () => {
    if (hasNoPortfolio) {
      setIsCreatePortfolioOpen(true);
      return;
    }
    if (activeSelection === 'all') {
      toast({
        title: 'Portföy seçin',
        description: 'İşlem ekleyeceğiniz portföyü üstteki seçiciden seçin.',
      });
      return;
    }
    if (!activePortfolio) {
      toast({ title: 'Portföy seçilmedi', description: 'Lütfen önce bir portföy seçin.' });
      return;
    }
    if (activePortfolio.status === 'closed') {
      toast({
        title: 'Kapalı portföy',
        description: 'Kapalı bir portföye işlem eklenemez. Önce portföyü yeniden açın.',
        variant: 'destructive',
      });
      return;
    }
    setIsStockSelectorOpen(true);
  };

  // FAB / shell navigates here with a timestamp in route state when the user
  // wants to add a trade. Open the stock selector once per distinct stamp so
  // repeat navigations re-trigger the flow.
  useEffect(() => {
    const stamp = (location.state as { openAddTrade?: number } | null)?.openAddTrade;
    if (typeof stamp !== 'number') return;
    if (lastOpenAddTradeStamp.current === stamp) return;
    lastOpenAddTradeStamp.current = stamp;
    handleOpenStockSelector();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleOpenCashFlow = () => {
    if (hasNoPortfolio) {
      setIsCreatePortfolioOpen(true);
      return;
    }
    if (activeSelection === 'all') {
      toast({
        title: 'Portföy seçin',
        description: 'Para ekleme/çıkarma bir portföye yapılır; üstten portföy seçin.',
      });
      return;
    }
    if (!activePortfolio) return;
    setIsCashFlowOpen(true);
  };

  const handleOpenExchange = () => {
    if (hasNoPortfolio) {
      setIsCreatePortfolioOpen(true);
      return;
    }
    if (activeSelection === 'all' || !activePortfolio) {
      toast({
        title: 'Portföy seçin',
        description: 'Çeviri işlemleri bir portföye bağlıdır; üstten portföy seçin.',
      });
      return;
    }
    setIsExchangeOpen(true);
  };

  const handleStockSelect = (stock: Stock & { logoUrl?: string }) => {
    setSelectedStock(stock);
  };

  const createSeparateTrade = async (tradeData: {
    stock_symbol: string;
    stock_name: string;
    trade_type: 'buy' | 'sell';
    entry_price: number;
    target_price: number;
    stop_price: number;
    reasons: string[];
    lot_quantity?: number;
  }) => {
    if (!activePortfolio) return;
    const result = await createTrade.mutateAsync({
      ...tradeData,
      portfolio_id: activePortfolio.id,
    });
    setSelectedStock(null);
    setHighlightedTradeId(result.id);
    setTimeout(() => setHighlightedTradeId(null), 2000);
  };

  const handleSaveTrade = async (tradeData: {
    stock_symbol: string;
    stock_name: string;
    trade_type: 'buy' | 'sell';
    entry_price: number;
    target_price: number;
    stop_price: number;
    reasons: string[];
    lot_quantity?: number;
  }) => {
    if (!activePortfolio) {
      toast({
        title: 'Portföy seçilmedi',
        description: 'İşlem kaydedilmeden önce bir portföy seçin.',
        variant: 'destructive',
      });
      return;
    }

    // Aynı (portföy, sembol, tür) için açık işlem var mı? Varsa merge promptu aç.
    // Lot zorunlu — ağırlıklı ortalama hesabı için gerekli.
    if (tradeData.lot_quantity && tradeData.lot_quantity > 0) {
      const candidates = (activeTrades as Trade[]).filter(
        (t) =>
          t.portfolio_id === activePortfolio.id &&
          t.stock_symbol === tradeData.stock_symbol &&
          t.trade_type === tradeData.trade_type &&
          t.lot_quantity > 0
      );
      if (candidates.length > 0) {
        setMergePrompt({
          candidates,
          incoming: {
            stock_symbol: tradeData.stock_symbol,
            stock_name: tradeData.stock_name,
            trade_type: tradeData.trade_type,
            entry_price: tradeData.entry_price,
            target_price: tradeData.target_price,
            stop_price: tradeData.stop_price,
            lot_quantity: tradeData.lot_quantity,
            reasons: tradeData.reasons,
          },
        });
        // TradeForm'u kapat; kullanıcı MergeTradeDialog üzerinden devam edecek.
        setSelectedStock(null);
        return;
      }
    }

    await createSeparateTrade(tradeData);
  };

  const handleMergeKeepSeparate = async () => {
    if (!mergePrompt) return;
    const { incoming } = mergePrompt;
    setMergePrompt(null);
    await createSeparateTrade({
      stock_symbol: incoming.stock_symbol,
      stock_name: incoming.stock_name,
      trade_type: incoming.trade_type,
      entry_price: incoming.entry_price,
      target_price: incoming.target_price,
      stop_price: incoming.stop_price,
      reasons: incoming.reasons,
      lot_quantity: incoming.lot_quantity,
    });
  };

  const handleMergeConfirm = async (targetTradeId: string) => {
    if (!mergePrompt) return;
    const { incoming } = mergePrompt;
    try {
      await mergeIntoTrade.mutateAsync({
        targetTradeId,
        addEntryPrice: incoming.entry_price,
        addTargetPrice: incoming.target_price,
        addStopPrice: incoming.stop_price,
        addLotQuantity: incoming.lot_quantity,
        addReasons: incoming.reasons,
      });
      setMergePrompt(null);
      setHighlightedTradeId(targetTradeId);
      setTimeout(() => setHighlightedTradeId(null), 2000);
    } catch {
      // hata toast'ı useTrades içinde zaten atılıyor; dialog açık kalsın ki kullanıcı tekrar deneyebilsin
    }
  };

  const handleCloseTrade = async (
    tradeId: string,
    exitPrice: number,
    closingType: ClosingType,
    lotQuantity: number,
    stopReason?: string,
    closingNote?: string
  ) => {
    await closeTrade.mutateAsync({ tradeId, exitPrice, closingType, lotQuantity, stopReason, closingNote });
  };

  const handleUpdateTrade = async (tradeId: string, data: TradeUpdateData) => {
    await updateTrade.mutateAsync({ tradeId, data });
  };

  const handleDeleteTrade = async (tradeId: string) => {
    await deleteTrade.mutateAsync(tradeId);
  };

  const handleRevertClose = async (entryId: string, tradeId: string) => {
    await revertPartialClose.mutateAsync({ entryId, tradeId });
  };

  const handleDeleteClosedTrade = async (entryId: string, tradeId: string) => {
    await deleteClosedTrade.mutateAsync({ entryId, tradeId });
  };

  // Cash flow / exchange modal'ına verilecek portföy id — "Tümü" seçiliyken açılmaması
  // handleOpen...'da engellendiği için burada activePortfolio garantili.
  const modalPortfolioId = activePortfolio?.id ?? '';

  return (
    <MainLayout>
      <PageHeader
        title="İşlemler"
        description={activePortfolio ? activePortfolio.name : 'Tüm portföyler'}
      />

      {/* Secondary actions — primary "Yeni İşlem" is the bottom-bar FAB */}
      <div className="mb-4 flex flex-wrap gap-2">
        <ActionChip
          icon={FolderPlus}
          label="Portföy Aç"
          onClick={() => setIsCreatePortfolioOpen(true)}
        />
        <ActionChip
          icon={Wallet}
          label="Ekle / Çıkar"
          onClick={handleOpenCashFlow}
        />
        <ActionChip
          icon={ArrowRightLeft}
          label="Çevirici"
          onClick={handleOpenExchange}
        />
      </div>

      {/* Trade Lists */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="active" className="gap-2">
            Aktif İşlemler
            {filteredActiveTrades.length > 0 && (
              <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                {filteredActiveTrades.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-2">
            Kapalı İşlemler
            {filteredMergedClosed.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                {filteredMergedClosed.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <TradeList
            trades={filteredActiveTrades}
            type="active"
            onCloseTrade={handleCloseTrade}
            onUpdateTrade={handleUpdateTrade}
            onDeleteTrade={handleDeleteTrade}
            highlightedTradeId={highlightedTradeId}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="closed" className="mt-0">
          <TradeList
            mergedClosedTrades={filteredMergedClosed}
            type="closed"
            isLoading={isLoading}
            onRevertClose={handleRevertClose}
            onDeleteClosedTrade={handleDeleteClosedTrade}
          />
        </TabsContent>
      </Tabs>

      {/* Stock Selector Modal */}
      <StockSelector
        isOpen={isStockSelectorOpen}
        onClose={() => setIsStockSelectorOpen(false)}
        onSelect={handleStockSelect}
      />

      {/* Trade Form Modal */}
      {selectedStock && activePortfolio && (
        <TradeForm
          stock={selectedStock}
          portfolioName={activePortfolio.name}
          onClose={() => setSelectedStock(null)}
          onSave={handleSaveTrade}
          isSubmitting={createTrade.isPending}
        />
      )}

      {/* Cash Flow Modal */}
      {isCashFlowOpen && activePortfolio && (
        <CashFlowModal
          portfolioId={modalPortfolioId}
          portfolioName={activePortfolio.name}
          onClose={() => setIsCashFlowOpen(false)}
        />
      )}

      {/* Exchange Modal */}
      {isExchangeOpen && activePortfolio && (
        <ExchangeModal
          portfolioId={modalPortfolioId}
          portfolioName={activePortfolio.name}
          onClose={() => setIsExchangeOpen(false)}
        />
      )}

      {/* Portfolio create modal */}
      <CreatePortfolioModal
        open={isCreatePortfolioOpen}
        onClose={() => setIsCreatePortfolioOpen(false)}
        hint={
          hasNoPortfolio
            ? 'İşlem ekleyebilmek için önce bir portföy oluşturun.'
            : undefined
        }
      />

      {/* Merge prompt (aynı sembolde açık işlem varsa) */}
      {mergePrompt && (
        <MergeTradeDialog
          candidates={mergePrompt.candidates}
          incoming={mergePrompt.incoming}
          onKeepSeparate={handleMergeKeepSeparate}
          onMerge={handleMergeConfirm}
          onClose={() => setMergePrompt(null)}
          isSubmitting={mergeIntoTrade.isPending || createTrade.isPending}
        />
      )}
    </MainLayout>
  );
}

/**
 * ActionChip — compact rectangular action used for secondary operations
 * (cash flow, exchange, create portfolio). Lower visual weight than the
 * primary FAB and well-spaced for touch.
 */
function ActionChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-full',
        'text-label text-foreground',
        'bg-surface-1 border border-border-subtle',
        'hover:bg-surface-2 hover:border-border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      {label}
    </button>
  );
}
