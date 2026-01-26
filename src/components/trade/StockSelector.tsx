import { useState, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StockLogo } from '@/components/ui/stock-logo';
import { Stock } from '@/types/trade';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';

interface StockSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stock: Stock) => void;
}

export function StockSelector({ isOpen, onClose, onSelect }: StockSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { stocks } = useMarketData();

  // Convert MarketStock to Stock format and filter
  const filteredStocks = useMemo(() => {
    const stockList: (Stock & { logoUrl?: string })[] = stocks.map((s, index) => ({
      id: `${index + 1}`,
      symbol: s.symbol,
      name: s.symbol, // API'den isim gelmiyorsa sembol kullan
      currentPrice: s.last,
      change: s.chg,
      changePercent: s.chgPct,
      logoUrl: s.logoUrl
    }));

    if (!searchQuery) return stockList;
    
    const query = searchQuery.toLowerCase();
    return stockList.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query)
    );
  }, [stocks, searchQuery]);

  const handleSelect = (stock: Stock) => {
    onSelect(stock);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-in-right sm:animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 bg-background-secondary border-b border-border p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Hisse Seç</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hisse ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Stock List */}
        <div className="overflow-y-auto max-h-[60vh] p-2">
          {filteredStocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Hisse bulunamadı
            </div>
          ) : (
            <div className="grid gap-1">
              {filteredStocks.map((stock) => (
                <button
                  key={stock.id}
                  onClick={() => handleSelect(stock)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <StockLogo 
                      symbol={stock.symbol} 
                      logoUrl={stock.logoUrl}
                      size="md"
                    />
                    <div>
                      <div className="font-semibold text-foreground">
                        {stock.symbol}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stock.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-foreground">
                      ₺{stock.currentPrice.toFixed(2)}
                    </div>
                    <div
                      className={cn(
                        'flex items-center justify-end gap-1 text-sm',
                        stock.change >= 0 ? 'text-profit' : 'text-loss'
                      )}
                    >
                      {stock.change >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>
                        {stock.change >= 0 ? '+' : ''}
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
