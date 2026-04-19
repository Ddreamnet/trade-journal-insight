import { useState, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetBody,
} from '@/components/ui/bottom-sheet';
import { StockLogo } from '@/components/ui/stock-logo';
import { Stock } from '@/types/trade';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';

interface StockSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stock: Stock & { logoUrl?: string }) => void;
}

type StockItem = Stock & { logoUrl?: string; isIndex?: boolean; currency?: 'TRY' | 'USD' };

/**
 * StockSelector — bottom-sheet stock picker with live search.
 *
 * List order (no search):
 *   1. Kripto & Emtia (USD-priced assets)
 *   2. XU030 index
 *   3. BIST stocks
 *
 * Auto-focuses the search input on open. Tap a row to select and close.
 */
export function StockSelector({ isOpen, onClose, onSelect }: StockSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { stocks, xu030 } = useMarketData();

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
    cryptoStocks.forEach((s, i) => list.push(toStockItem(s, i)));
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
    bistStocks.forEach((s, i) => list.push(toStockItem(s, cryptoStocks.length + 1 + i)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSelect = (stock: Stock & { logoUrl?: string }) => {
    onSelect(stock);
    setSearchQuery('');
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearchQuery('');
      onClose();
    }
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheetContent size="lg" className="md:max-h-[80vh]">
        <BottomSheetHeader className="pb-0">
          <BottomSheetTitle>Hisse Seç</BottomSheetTitle>
        </BottomSheetHeader>

        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Sembol veya isim ara…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
              autoFocus
            />
          </div>
        </div>

        <BottomSheetBody className="px-2 pb-2">
          {filteredStocks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-body">Varlık bulunamadı</p>
              <p className="text-caption mt-1">Farklı bir terim deneyin</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {!searchQuery && cryptoStocks.length > 0 && (
                <SectionLabel>Kripto &amp; Emtia</SectionLabel>
              )}

              {filteredStocks.map((stock, idx) => {
                const showBistHeader =
                  !searchQuery && cryptoStocks.length > 0 && idx === cryptoStocks.length;

                return (
                  <div key={stock.id}>
                    {showBistHeader && <SectionLabel>BIST Hisseleri</SectionLabel>}
                    <button
                      type="button"
                      onClick={() => handleSelect(stock)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 p-3 rounded-lg text-left',
                        'hover:bg-surface-2 active:bg-surface-3 transition-colors'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <StockLogo
                          symbol={stock.symbol}
                          logoUrl={stock.logoUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="text-body font-semibold text-foreground truncate">
                            {stock.symbol}
                          </div>
                          <div className="text-label text-muted-foreground truncate">
                            {stock.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="num text-foreground">
                          {formatPrice(stock.currentPrice, stock.currency ?? stock.symbol)}
                        </div>
                        <div
                          className={cn(
                            'flex items-center justify-end gap-0.5 text-caption font-mono font-semibold',
                            stock.change >= 0 ? 'text-profit' : 'text-loss'
                          )}
                        >
                          {stock.change >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {stock.change >= 0 ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-caption text-muted-foreground">
      {children}
    </div>
  );
}
