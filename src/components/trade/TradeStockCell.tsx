import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Trade, ClosedTradeEntry } from '@/types/trade';
import { cn } from '@/lib/utils';
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
      <TradeIcon tradeType={trade.trade_type} />
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
      <TradeIcon tradeType={entry.trade_type} />
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
      <TradeIcon tradeType={tradeType} />
      <div>
        <div className="font-semibold text-foreground text-sm">{symbol}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[80px]">{name}</div>
      </div>
    </div>
  );
}

function TradeIcon({ tradeType }: { tradeType: string }) {
  return (
    <div
      className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        tradeType === 'buy' ? 'bg-profit/20' : 'bg-loss/20'
      )}
    >
      {tradeType === 'buy' ? (
        <TrendingUp className="w-4 h-4 text-profit" />
      ) : (
        <TrendingDown className="w-4 h-4 text-loss" />
      )}
    </div>
  );
}
