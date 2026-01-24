import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { StockSelector } from '@/components/trade/StockSelector';
import { TradeForm } from '@/components/trade/TradeForm';
import { TradeList } from '@/components/trade/TradeList';
import { Stock } from '@/types/trade';
import { useTrades } from '@/hooks/useTrades';

export default function Index() {
  const [isStockSelectorOpen, setIsStockSelectorOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);

  const { activeTrades, closedTrades, createTrade, closeTrade, isLoading } = useTrades();

  const handleStockSelect = (stock: Stock) => {
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
  }) => {
    const result = await createTrade.mutateAsync(tradeData);
    setSelectedStock(null);
    setHighlightedTradeId(result.id);
    
    // Remove highlight after animation
    setTimeout(() => {
      setHighlightedTradeId(null);
    }, 2000);
  };

  const handleCloseTrade = async (
    tradeId: string,
    exitPrice: number
  ) => {
    await closeTrade.mutateAsync({ tradeId, exitPrice });
  };

  return (
    <MainLayout>
      {/* New Trade Button */}
      <div className="mb-6">
        <Button
          size="lg"
          className="w-full sm:w-auto gap-2 h-14 text-base"
          onClick={() => setIsStockSelectorOpen(true)}
        >
          <Plus className="w-5 h-5" />
          Yeni İşlem Ekle
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
            {closedTrades.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                {closedTrades.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <TradeList
            trades={activeTrades}
            type="active"
            onCloseTrade={handleCloseTrade}
            highlightedTradeId={highlightedTradeId}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="closed" className="mt-0">
          <TradeList 
            trades={closedTrades} 
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
    </MainLayout>
  );
}
