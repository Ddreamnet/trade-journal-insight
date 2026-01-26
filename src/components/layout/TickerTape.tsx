import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';

export function TickerTape() {
  const { stocks } = useMarketData();
  
  // Duplicate for seamless loop
  const displayStocks = [...stocks, ...stocks];

  return (
    <div className="w-full bg-background-secondary border-b border-border overflow-hidden">
      <div className="relative">
        {/* Gradient fades */}
        <div className="absolute left-0 top-0 bottom-0 w-16 gradient-fade-left z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 gradient-fade-right z-10 pointer-events-none" />
        
        {/* Ticker content */}
        <div className="ticker-tape flex items-center py-2 whitespace-nowrap">
          {displayStocks.map((stock, index) => (
            <div
              key={`${stock.symbol}-${index}`}
              className="flex items-center gap-2 px-4 border-r border-border/50 last:border-r-0"
            >
              <span className="font-semibold text-foreground text-sm">
                {stock.symbol}
              </span>
              <span className="font-mono text-sm text-foreground">
                ₺{stock.last.toFixed(2)}
              </span>
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  stock.chgPct >= 0 ? 'text-profit' : 'text-loss'
                )}
              >
                {stock.chgPct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>
                  {stock.chgPct >= 0 ? '+' : ''}
                  {stock.chgPct.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
