import { useMemo, useState } from 'react';
import { Plus, Wallet, ArrowRightLeft, FolderPlus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { StockSelector } from '@/components/trade/StockSelector';
import { TradeForm } from '@/components/trade/TradeForm';
import { TradeList } from '@/components/trade/TradeList';
import { CashFlowModal } from '@/components/trade/CashFlowModal';
import { ExchangeModal } from '@/components/trade/ExchangeModal';
import { PortfolioSelector } from '@/components/portfolio/PortfolioSelector';
import { CreatePortfolioModal } from '@/components/portfolio/CreatePortfolioModal';
import { ManagePortfoliosModal } from '@/components/portfolio/ManagePortfoliosModal';
import { Stock, ClosingType, Trade } from '@/types/trade';
import { TradeUpdateData } from '@/components/trade/EditTradeModal';
import { useTrades } from '@/hooks/useTrades';
import { usePortfolioContext } from '@/contexts/PortfolioContext';
import { toast } from '@/hooks/use-toast';

export default function Islemlerim() {
  const [isStockSelectorOpen, setIsStockSelectorOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<(Stock & { logoUrl?: string }) | null>(null);
  const [isCashFlowOpen, setIsCashFlowOpen] = useState(false);
  const [isExchangeOpen, setIsExchangeOpen] = useState(false);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);

  const {
    activeTrades, closedTradeEntries,
    createTrade, closeTrade, updateTrade, deleteTrade,
    revertPartialClose, deleteClosedTrade, isLoading,
  } = useTrades();

  const {
    activeSelection, activePortfolio, portfolios, activePortfolios,
  } = usePortfolioContext();

  // Seçime göre işlem ve kısmi kapanış filtreleri
  const filteredActiveTrades = useMemo(() => {
    if (activeSelection === 'all' || activeSelection === null) return activeTrades;
    return (activeTrades as Trade[]).filter(t => t.portfolio_id === activeSelection);
  }, [activeTrades, activeSelection]);

  const filteredClosedEntries = useMemo(() => {
    if (activeSelection === 'all' || activeSelection === null) return closedTradeEntries;
    return closedTradeEntries.filter(e => e.portfolio_id === activeSelection);
  }, [closedTradeEntries, activeSelection]);

  const canAddTrade = activePortfolio?.status === 'active';
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
    const result = await createTrade.mutateAsync({
      ...tradeData,
      portfolio_id: activePortfolio.id,
    });
    setSelectedStock(null);
    setHighlightedTradeId(result.id);
    setTimeout(() => setHighlightedTradeId(null), 2000);
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
      {/* Portföy seçici satırı */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground mb-1">Portföy</div>
          <PortfolioSelector className="w-full sm:w-72" />
        </div>
        {activePortfolios.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsManageOpen(true)}
            className="self-start sm:self-end gap-2 text-muted-foreground"
          >
            <Settings2 className="w-4 h-4" />
            Portföyleri Yönet
          </Button>
        )}
      </div>

      {/* Aksiyon butonları: mobilde dikey (Portföy Aç en üstte), masaüstünde yatay (Portföy Aç solda) */}
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-end gap-3">
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto gap-2 order-1 sm:order-none"
          onClick={() => setIsCreatePortfolioOpen(true)}
        >
          <FolderPlus className="w-4 h-4" />
          Portföy Hesabı Aç
        </Button>
        <Button
          size="lg"
          className="w-full sm:w-auto gap-2 order-2 sm:order-none"
          onClick={handleOpenStockSelector}
          disabled={!canAddTrade && activeSelection !== 'all' && !hasNoPortfolio}
        >
          <Plus className="w-4 h-4" />
          Yeni İşlem Ekle
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto gap-2 order-3 sm:order-none"
          onClick={handleOpenCashFlow}
        >
          <Wallet className="w-4 h-4" />
          Portföy Ekle/Çıkar
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto gap-2 order-4 sm:order-none"
          onClick={handleOpenExchange}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Çevirici
        </Button>
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
            {filteredClosedEntries.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                {filteredClosedEntries.length}
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
            closedEntries={filteredClosedEntries}
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

      {/* Portfolio manage modal */}
      <ManagePortfoliosModal
        open={isManageOpen}
        onClose={() => setIsManageOpen(false)}
      />
    </MainLayout>
  );
}
