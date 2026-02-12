import React, { useMemo, useRef, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';

const SPEED = 50; // px/s

export const TickerTape = React.memo(function TickerTape() {
  const { stocks } = useMarketData();
  const tickerRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const displayStocks = useMemo(() => [...stocks, ...stocks], [stocks]);

  // Calculate duration only once on first data load
  useEffect(() => {
    if (durationRef.current !== null) return;
    if (!tickerRef.current || stocks.length === 0) return;

    const rafId = requestAnimationFrame(() => {
      if (!tickerRef.current) return;
      const scrollWidth = tickerRef.current.scrollWidth;
      if (scrollWidth > 0) {
        const halfWidth = scrollWidth / 2;
        const calculatedDuration = halfWidth / SPEED;
        durationRef.current = calculatedDuration;
        setDuration(calculatedDuration);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [stocks]);

  return (
    <div className="w-full bg-background-secondary border-b border-border overflow-hidden">
      <div className="relative">
        {/* Gradient fades */}
        <div className="absolute left-0 top-0 bottom-0 w-16 gradient-fade-left z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 gradient-fade-right z-10 pointer-events-none" />
        
        {/* Ticker content */}
        <div
          ref={tickerRef}
          className="ticker-tape flex items-center py-2 whitespace-nowrap"
          style={{
            animation: duration
              ? `ticker ${duration}s linear infinite`
              : stocks.length > 0
                ? 'ticker 60s linear infinite'
                : 'none',
            willChange: 'transform',
          }}
        >
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
});
