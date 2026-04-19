import { TrendingUp, TrendingDown, AlertTriangle, Layers } from 'lucide-react';
import { Trade, ClosedTradeEntry } from '@/types/trade';
import { MergedClosedTrade } from '@/lib/tradeMerge';
import { cn } from '@/lib/utils';
import { StockLogo } from '@/components/ui/stock-logo';
import { useMarketData } from '@/contexts/MarketDataContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActiveStockCellProps {
  trade: Trade;
  showLotWarning?: boolean;
  onClick: (trade: Trade) => void;
}

export function ActiveStockCell({ trade, showLotWarning = false, onClick }: ActiveStockCellProps) {
  return (
    <button
      onClick={() => onClick(trade)}
      className="flex items-center gap-2 cursor-pointer rounded-lg p-1 -m-1 hover:bg-secondary/60 transition-colors"
    >
      <TradeLogo symbol={trade.stock_symbol} tradeType={trade.trade_type} />
      <div className="text-left">
        <div className="font-semibold text-foreground text-sm flex items-center gap-1">
          {trade.stock_symbol}
          {showLotWarning && trade.lot_quantity === 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="w-3 h-3 text-warning" />
                </TooltipTrigger>
                <TooltipContent>Lot bilgisi eksik</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {trade.merge_count > 1 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center gap-0.5 text-caption px-1 py-0.5 rounded-md bg-primary/10 text-primary">
                    <Layers className="w-2.5 h-2.5" />
                    {trade.merge_count}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{trade.merge_count} işlem birleşmiş</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate max-w-[80px]">{trade.stock_name}</div>
      </div>
    </button>
  );
}

interface ClosedStockCellProps {
  entry: ClosedTradeEntry;
  onClick: (entry: ClosedTradeEntry) => void;
}

export function ClosedStockCell({ entry, onClick }: ClosedStockCellProps) {
  return (
    <button
      onClick={() => onClick(entry)}
      className="flex items-center gap-2 cursor-pointer rounded-lg p-1 -m-1 hover:bg-secondary/60 transition-colors"
    >
      <TradeLogo symbol={entry.stock_symbol} tradeType={entry.trade_type} />
      <div className="text-left">
        <div className="font-semibold text-foreground text-sm">{entry.stock_symbol}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[80px]">{entry.stock_name}</div>
      </div>
    </button>
  );
}

interface StaticStockCellProps {
  symbol: string;
  name: string;
  tradeType: string;
}

export function StaticStockCell({ symbol, name, tradeType }: StaticStockCellProps) {
  return (
    <div className="flex items-center gap-2">
      <TradeLogo symbol={symbol} tradeType={tradeType} />
      <div>
        <div className="font-semibold text-foreground text-sm">{symbol}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[80px]">{name}</div>
      </div>
    </div>
  );
}

interface MergedClosedStockCellProps {
  merged: MergedClosedTrade;
  onClick: (merged: MergedClosedTrade) => void;
}

export function MergedClosedStockCell({ merged, onClick }: MergedClosedStockCellProps) {
  return (
    <button
      onClick={() => onClick(merged)}
      className="flex items-center gap-2 cursor-pointer rounded-lg p-1 -m-1 hover:bg-secondary/60 transition-colors"
    >
      <TradeLogo symbol={merged.stock_symbol} tradeType={merged.trade_type} />
      <div className="text-left">
        <div className="font-semibold text-foreground text-sm">{merged.stock_symbol}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[100px]">{merged.stock_name}</div>
      </div>
    </button>
  );
}

function TradeLogo({ symbol, tradeType }: { symbol: string; tradeType: string }) {
  const { getStockBySymbol } = useMarketData();
  const marketStock = getStockBySymbol(symbol);

  return (
    <div className="relative shrink-0">
      <StockLogo symbol={symbol} logoUrl={marketStock?.logoUrl} size="md" />
      <div
        className={cn(
          'absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-card',
          tradeType === 'buy' ? 'bg-profit' : 'bg-loss'
        )}
        aria-label={tradeType === 'buy' ? 'Alış' : 'Satış'}
      >
        {tradeType === 'buy' ? (
          <TrendingUp className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        ) : (
          <TrendingDown className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        )}
      </div>
    </div>
  );
}
