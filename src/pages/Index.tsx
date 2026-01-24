import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { StockSelector } from '@/components/trade/StockSelector';
import { TradeForm } from '@/components/trade/TradeForm';
import { TradeList } from '@/components/trade/TradeList';
import { Stock, Trade } from '@/types/trade';
import { toast } from '@/hooks/use-toast';

interface IndexProps {
  onLogout: () => void;
}

export default function Index({ onLogout }: IndexProps) {
  const [isStockSelectorOpen, setIsStockSelectorOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);

  const activeTrades = trades.filter((t) => t.status === 'active');
  const closedTrades = trades.filter((t) => t.status === 'closed');

  const handleStockSelect = (stock: Stock) => {
    setSelectedStock(stock);
  };

  const handleSaveTrade = useCallback(
    (tradeData: Omit<Trade, 'id' | 'created_at' | 'current_price'>) => {
      const newTrade: Trade = {
        ...tradeData,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        current_price: tradeData.entry_price,
      };

      setTrades((prev) => [newTrade, ...prev]);
      setSelectedStock(null);
      setHighlightedTradeId(newTrade.id);

      toast({
        title: 'İşlem kaydedildi!',
        description: `${tradeData.stock_symbol} ${tradeData.trade_type === 'buy' ? 'alış' : 'satış'} işlemi eklendi.`,
      });

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedTradeId(null);
      }, 2000);
    },
    []
  );

  const handleCloseTrade = useCallback(
    (
      tradeId: string,
      exitPrice: number,
      progressPercent: number,
      result: 'success' | 'failure'
    ) => {
      setTrades((prev) =>
        prev.map((trade) =>
          trade.id === tradeId
            ? {
                ...trade,
                status: 'closed' as const,
                exit_price: exitPrice,
                progress_percent: progressPercent,
                result,
                closed_at: new Date().toISOString(),
              }
            : trade
        )
      );

      toast({
        title: result === 'success' ? '✅ Başarılı işlem!' : '❌ Başarısız işlem',
        description: `İşlem %${progressPercent.toFixed(1)} ilerleme ile kapatıldı.`,
      });
    },
    []
  );

  return (
    <MainLayout onLogout={onLogout}>
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
          />
        </TabsContent>

        <TabsContent value="closed" className="mt-0">
          <TradeList trades={closedTrades} type="closed" />
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
        />
      )}
    </MainLayout>
  );
}
