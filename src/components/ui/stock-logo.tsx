import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface StockLogoProps {
  symbol: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
};

export function StockLogo({ symbol, logoUrl, size = 'md', className }: StockLogoProps) {
  const [imgError, setImgError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = useCallback(() => {
    setImgError(true);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const fallbackContent = (
    <span className="font-bold text-primary">
      {symbol.slice(0, 2)}
    </span>
  );

  return (
    <div
      className={cn(
        'rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {logoUrl && !imgError ? (
        <>
          {/* Skeleton placeholder while loading */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-primary/5 animate-pulse rounded-lg" />
          )}
          <img
            src={logoUrl}
            alt={`${symbol} logo`}
            loading="lazy"
            decoding="async"
            onError={handleError}
            onLoad={handleLoad}
            className={cn(
              'w-full h-full object-contain transition-opacity duration-200',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
          />
        </>
      ) : (
        fallbackContent
      )}
    </div>
  );
}
