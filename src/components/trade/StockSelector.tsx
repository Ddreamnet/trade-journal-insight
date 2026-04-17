import { useState, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StockLogo } from '@/components/ui/stock-logo';
import { Stock } from '@/types/trade';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';

interface StockSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stock: Stock & {logoUrl?: string;}) => void;
}

type StockItem = Stock & { logoUrl?: string; isIndex?: boolean; currency?: 'TRY' | 'USD'; };

export function StockSelector({ isOpen, onClose, onSelect }: StockSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { stocks, xu030 } = useMarketData();

  // Kripto/emtia: currency === 'USD', BIST: geri kalan
  const cryptoStocks = useMemo(() => stocks.filter(s => s.currency === 'USD'), [stocks]);
  const bistStocks = useMemo(() => stocks.filter(s => s.currency !== 'USD'), [stocks]);

  const toStockItem = (s: typeof stocks[number], index: number): StockItem => ({
    id: `${index}`,
    symbol: s.symbol,
    name: s.name ?? s.symbol,
    currentPrice: s.last,
    change: s.chg,
    changePercent: s.chgPct,
    logoUrl: s.logoUrl,
    currency: s.currency,
  });

  const allItems = useMemo<StockItem[]>(() => {
    const list: StockItem[] = [];

    // 1. Kripto & Emtia (en üstte)
    cryptoStocks.forEach((s, i) => list.push(toStockItem(s, i)));

    // 2. XU030 endeksi
    if (xu030) {
      list.push({
        id: 'xu030',
        symbol: 'XU030',
        name: 'BIST 30 Endeksi',
        currentPrice: xu030.last,
        change: 0,
        changePercent: xu030.chgPct,
        isIndex: true,
        currency: 'TRY',
      });
    }

    // 3. BIST hisseleri
    bistStocks.forEach((s, i) => list.push(toStockItem(s, cryptoStocks.length + 1 + i)));

    return list;
  }, [cryptoStocks, bistStocks, xu030]);

  const filteredStocks = useMemo(() => {
    if (!searchQuery) return allItems;
    const query = searchQuery.toLowerCase();
    return allItems.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query)
    );
  }, [allItems, searchQuery]);

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
        onClick={onClose} />


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
              autoFocus />

          </div>
        </div>

        {/* Stock List */}
        <div className="overflow-y-auto max-h-[60vh] p-2">
          {filteredStocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Varlık bulunamadı
            </div>
          ) : (
            <div className="grid gap-1">
              {/* Kripto & Emtia başlığı (arama yokken göster) */}
              {!searchQuery && cryptoStocks.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Kripto & Emtia
                </div>
              )}

              {filteredStocks.map((stock, idx) => {
                // BIST başlığını kripto bitince göster (arama yokken)
                const showBistHeader =
                  !searchQuery &&
                  cryptoStocks.length > 0 &&
                  idx === cryptoStocks.length;

                return (
                  <div key={stock.id}>
                    {showBistHeader && (
                      <div className="px-3 py-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t border-border/50">
                        BIST Hisseleri
                      </div>
                    )}
                    <button
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
                          <span className="font-semibold text-foreground">
                            {stock.symbol}
                          </span>
                          <div className="text-sm text-muted-foreground">
                            {stock.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-foreground">
                          {formatPrice(stock.currentPrice, stock.currency ?? stock.symbol)}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>);

}