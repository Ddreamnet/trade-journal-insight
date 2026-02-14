import { useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { StockSelector } from '@/components/trade/StockSelector';
import { TradeForm } from '@/components/trade/TradeForm';
import { TradeList } from '@/components/trade/TradeList';
import { CashFlowModal } from '@/components/trade/CashFlowModal';
import { Stock, ClosingType } from '@/types/trade';
import { TradeUpdateData } from '@/components/trade/EditTradeModal';
import { useTrades } from '@/hooks/useTrades';

export default function Index() {
  const [isStockSelectorOpen, setIsStockSelectorOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<(Stock & { logoUrl?: string }) | null>(null);
  const [isCashFlowOpen, setIsCashFlowOpen] = useState(false);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);

  const { activeTrades, closedTradeEntries, createTrade, closeTrade, updateTrade, deleteTrade, isLoading } = useTrades();

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
    const result = await createTrade.mutateAsync(tradeData);
    setSelectedStock(null);
    setHighlightedTradeId(result.id);
    
    setTimeout(() => {
      setHighlightedTradeId(null);
    }, 2000);
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

  return (
    <MainLayout>
      {/* Buttons */}
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-end gap-3">
        <Button
          size="lg"
          className="w-full sm:w-auto gap-2"
          onClick={() => setIsStockSelectorOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Yeni İşlem Ekle
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto gap-2"
          onClick={() => setIsCashFlowOpen(true)}
        >
          <Wallet className="w-4 h-4" />
          Portföy Ekle/Çıkar
        </Button>
      </div>

      {/* Trade Lists */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="active" className="gap-2">
            Aktif Portföy
            {activeTrades.length > 0 && (
              <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                {activeTrades.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-2">
            Kapalı Portföyler
            {closedTradeEntries.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                {closedTradeEntries.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <TradeList
            trades={activeTrades}
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
            closedEntries={closedTradeEntries}
            type="closed"
            isLoading={isLoading}
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
      {selectedStock && (
        <TradeForm
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onSave={handleSaveTrade}
          isSubmitting={createTrade.isPending}
        />
      )}

      {/* Cash Flow Modal */}
      {isCashFlowOpen && (
        <CashFlowModal onClose={() => setIsCashFlowOpen(false)} />
      )}
    </MainLayout>
  );
}
