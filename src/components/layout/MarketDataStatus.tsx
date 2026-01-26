import { useMarketData } from '@/contexts/MarketDataContext';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MarketDataStatus() {
  const { lastUpdated, isLoading, isFallback, refetch } = useMarketData();

  const formatTime = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {isFallback && (
        <div className="flex items-center gap-1 text-warning">
          <AlertCircle className="w-3 h-3" />
          <span>Önbellek</span>
        </div>
      )}
      
      {lastUpdated && (
        <span>
          Son: {formatTime(lastUpdated)}
        </span>
      )}
      
      <button
        onClick={() => refetch()}
        disabled={isLoading}
        className={cn(
          'p-1 rounded hover:bg-secondary transition-colors',
          isLoading && 'animate-spin'
        )}
        title="Yenile"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  );
}
