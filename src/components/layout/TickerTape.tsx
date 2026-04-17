import React, { useMemo, useRef, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMarketData } from '@/contexts/MarketDataContext';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/currency';

const SPEED = 50; // px/s

export const TickerTape = React.memo(function TickerTape() {
  const { stocks } = useMarketData();
  const tickerRef = useRef<HTMLDivElement>(null);
  const measuredRef = useRef(false);
  const [halfWidth, setHalfWidth] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const displayStocks = useMemo(() => [...stocks, ...stocks], [stocks]);

  // Measure scrollWidth once on first data load and calculate animation params
  useEffect(() => {
    if (measuredRef.current) return;
    if (!tickerRef.current || stocks.length === 0) return;

    const rafId = requestAnimationFrame(() => {
      if (!tickerRef.current) return;
      const sw = tickerRef.current.scrollWidth;
      if (sw > 0) {
        const half = sw / 2;
        measuredRef.current = true;
        setHalfWidth(half);
        setDuration(half / SPEED);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [stocks]);

  return (
    <div className="w-full bg-background-secondary border-b border-border overflow-hidden">
      {/* Inject keyframes directly — immune to CSS build pipeline */}
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(var(--ticker-offset, -2000px)); }
        }
      `}</style>

      <div className="relative">
        {/* Gradient fades */}
        <div className="absolute left-0 top-0 bottom-0 w-16 gradient-fade-left z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 gradient-fade-right z-10 pointer-events-none" />

        {/* Ticker content */}
        <div
          ref={tickerRef}
          className="ticker-tape flex items-center py-2 whitespace-nowrap"
          style={{
            ['--ticker-offset' as string]: halfWidth ? `-${halfWidth}px` : '-2000px',
            animationDuration: duration ? `${duration}s` : '60s',
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
                {formatPrice(stock.last, stock.currency ?? stock.symbol)}
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
