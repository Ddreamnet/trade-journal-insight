import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useBistPrices } from '@/hooks/useBistPrices';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export function TickerTape() {
  const { getTickerStocks, isLoading, isFetching, isUsingCachedData, cacheTimestamp } = useBistPrices();
  
  const tickerStocks = getTickerStocks(25);
  
  // Duplicate for seamless loop
  const stocks = [...tickerStocks, ...tickerStocks];

  if (isLoading && stocks.length === 0) {
    return (
      <div className="w-full bg-background-secondary border-b border-border overflow-hidden">
        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
          Veriler yükleniyor...
        </div>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="w-full bg-background-secondary border-b border-border overflow-hidden">
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          Henüz veri yok - piyasa açıldığında güncellenecek
        </div>
      </div>
    );
  }

  // Format cache timestamp
  const cacheInfo = cacheTimestamp 
    ? format(cacheTimestamp, "d MMM HH:mm", { locale: tr })
    : null;

  return (
    <div className="w-full bg-background-secondary border-b border-border overflow-hidden">
      <div className="relative">
        {/* Cache indicator - shows when using cached data */}
        {isUsingCachedData && cacheInfo && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Son veri: {cacheInfo}</span>
          </div>
        )}
        
        {/* Gradient fades */}
        <div className="absolute left-0 top-0 bottom-0 w-16 gradient-fade-left z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 gradient-fade-right z-10 pointer-events-none" />
        
        {/* Ticker content */}
        <div className={cn(
          "ticker-tape flex items-center py-2 whitespace-nowrap",
          isFetching && "opacity-80"
        )}>
          {stocks.map((stock, index) => (
            <div
              key={`${stock.symbol}-${index}`}
              className="flex items-center gap-2 px-4 border-r border-border/50 last:border-r-0"
            >
              <span className="font-semibold text-foreground text-sm">
                {stock.symbol}
              </span>
              <span className="font-mono text-sm text-foreground">
                ₺{stock.lastPrice.toFixed(2)}
              </span>
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
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
          ))}
        </div>
      </div>
    </div>
  );
}
