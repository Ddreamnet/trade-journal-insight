import { useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Layers, AlertTriangle } from "lucide-react";
import { Trade } from "@/types/trade";
import { useMarketData } from "@/contexts/MarketDataContext";
import { cn } from "@/lib/utils";
import { formatPrice, getSymbolCurrency } from "@/lib/currency";
import { StockLogo } from "@/components/ui/stock-logo";

/**
 * ActivePositionCard — mobile-first card for a single open position.
 *
 * Visual hierarchy (top to bottom):
 *   1. Symbol + name + type chip + meta badges (merged, partial-closed)
 *   2. Current price + realtime P&L (the answer to "how is this doing?")
 *   3. Entry → current → target progress strip (shows where we are in the plan)
 *   4. Entry / Target / Stop triad for reference
 *
 * The entire card is tappable; the parent decides what that means
 * (opens ActiveTradeActionDialog in the current product).
 */
interface ActivePositionCardProps {
  trade: Trade;
  onClick: (trade: Trade) => void;
  highlighted?: boolean;
}

export function ActivePositionCard({
  trade,
  onClick,
  highlighted = false,
}: ActivePositionCardProps) {
  const { getStockBySymbol } = useMarketData();
  const marketStock = getStockBySymbol(trade.stock_symbol);
  const currency = getSymbolCurrency(trade.stock_symbol);
  const currentPrice = marketStock?.last ?? null;

  // P&L math
  const { pnlAbs, pnlPct } = useMemo(() => {
    if (currentPrice === null) return { pnlAbs: 0, pnlPct: 0 };
    const sign = trade.trade_type === "buy" ? 1 : -1;
    const diff = currentPrice - trade.entry_price;
    const abs = sign * diff * trade.remaining_lot;
    const pct = trade.entry_price
      ? (sign * diff / trade.entry_price) * 100
      : 0;
    return { pnlAbs: abs, pnlPct: pct };
  }, [currentPrice, trade]);

  // Position of current price within [stop, target] — for the progress strip.
  // Normalized 0..1 where 0 = at stop, 1 = at target. May go outside [0,1].
  const progressPos = useMemo(() => {
    if (currentPrice === null) return 0.5;
    const { stop_price: stop, target_price: target } = trade;
    const range = Math.abs(target - stop);
    if (range === 0) return 0.5;
    if (trade.trade_type === "buy") {
      return (currentPrice - stop) / range;
    }
    return (stop - currentPrice) / range;
  }, [currentPrice, trade]);

  const positionOfEntry = useMemo(() => {
    const { stop_price: stop, target_price: target, entry_price: entry } = trade;
    const range = Math.abs(target - stop);
    if (range === 0) return 0.5;
    if (trade.trade_type === "buy") return (entry - stop) / range;
    return (stop - entry) / range;
  }, [trade]);

  const isUp = pnlAbs >= 0;
  const isPartial = trade.remaining_lot < trade.lot_quantity;
  const isMerged = trade.merge_count > 1;
  const lotMissing = trade.lot_quantity === 0;

  return (
    <button
      type="button"
      onClick={() => onClick(trade)}
      className={cn(
        "w-full text-left rounded-xl p-4",
        "bg-surface-2 border border-border-subtle",
        "hover:bg-surface-3 transition-colors",
        "active:scale-[0.995]",
        highlighted && "ring-1 ring-primary bg-primary/5 border-primary/30"
      )}
    >
      {/* Row 1: Identity */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <StockLogo
            symbol={trade.stock_symbol}
            logoUrl={marketStock?.logoUrl}
            size="md"
          />
          <span
            className={cn(
              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-2 ring-surface-2",
              "flex items-center justify-center text-[9px] font-bold text-white",
              trade.trade_type === "buy" ? "bg-profit" : "bg-loss"
            )}
            aria-hidden
          >
            {trade.trade_type === "buy" ? "↑" : "↓"}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-title text-foreground">{trade.stock_symbol}</span>
            <span
              className={cn(
                "text-caption px-1.5 py-0.5 rounded",
                trade.trade_type === "buy"
                  ? "bg-profit-soft text-profit"
                  : "bg-loss-soft text-loss"
              )}
            >
              {trade.trade_type === "buy" ? "AL" : "SAT"}
            </span>
            {isMerged && (
              <span
                className="inline-flex items-center gap-0.5 text-caption px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground"
                title={`${trade.merge_count} işlem birleşmiş`}
              >
                <Layers className="w-2.5 h-2.5" />
                {trade.merge_count}
              </span>
            )}
            {lotMissing && (
              <AlertTriangle
                className="w-3 h-3 text-warning"
                aria-label="Lot bilgisi eksik"
              />
            )}
          </div>
          <div className="text-label text-muted-foreground truncate mt-0.5">
            {trade.stock_name}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-label text-muted-foreground">
            {isPartial ? (
              <span>
                <span className="text-warning font-semibold">
                  {trade.remaining_lot}
                </span>
                /{trade.lot_quantity} lot
              </span>
            ) : (
              <span>{trade.remaining_lot} lot</span>
            )}
          </div>
          {trade.rr_ratio !== null && (
            <div className="text-caption text-muted-foreground mt-0.5">
              RR{" "}
              <span
                className={cn(
                  "font-mono font-semibold",
                  trade.rr_ratio >= 3 ? "text-profit" : "text-loss"
                )}
              >
                {trade.rr_ratio.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Price + P&L */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-caption text-muted-foreground">Anlık</div>
          <div className="num-lg text-foreground">
            {currentPrice !== null
              ? formatPrice(currentPrice, currency)
              : "—"}
          </div>
        </div>
        <div className="text-right">
          {currentPrice !== null ? (
            <>
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-label font-mono font-semibold",
                  isUp ? "text-profit" : "text-loss"
                )}
              >
                {isUp ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {isUp ? "+" : ""}
                {pnlPct.toFixed(2)}%
              </div>
              <div
                className={cn(
                  "num-sm mt-0.5",
                  isUp ? "text-profit" : "text-loss"
                )}
              >
                {isUp ? "+" : "−"}
                {currency === "USD" ? "$" : "₺"}
                {Math.abs(pnlAbs).toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </>
          ) : (
            <div className="text-caption text-muted-foreground">
              Fiyat yok
            </div>
          )}
        </div>
      </div>

      {/* Row 3: progress strip from stop → entry → target */}
      {currentPrice !== null && (
        <ProgressStrip
          pos={progressPos}
          entryPos={positionOfEntry}
          isUp={isUp}
        />
      )}

      {/* Row 4: triad */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <TriadCell label="Giriş" value={formatPrice(trade.entry_price, currency)} />
        <TriadCell
          label="Hedef"
          value={formatPrice(trade.target_price, currency)}
          tone="profit"
        />
        <TriadCell
          label="Stop"
          value={formatPrice(trade.stop_price, currency)}
          tone="loss"
        />
      </div>
    </button>
  );
}

function TriadCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div>
      <div className="text-caption text-muted-foreground">{label}</div>
      <div
        className={cn(
          "num-sm mt-0.5",
          tone === "profit" && "text-profit/85",
          tone === "loss" && "text-loss/85",
          !tone && "text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * ProgressStrip — compact visual showing current price position between
 * stop (left) and target (right), with a tick at entry.
 *
 * On "buy" trades: left = stop, right = target. On "sell" trades we flip
 * the axis upstream, so this just renders linearly.
 */
function ProgressStrip({
  pos,
  entryPos,
  isUp,
}: {
  pos: number;
  entryPos: number;
  isUp: boolean;
}) {
  const clamped = Math.max(0, Math.min(1, pos));
  const entryClamped = Math.max(0, Math.min(1, entryPos));

  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-surface-3 overflow-visible">
        {/* Entry tick (subtle) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-muted-foreground/60"
          style={{ left: `${entryClamped * 100}%` }}
          aria-hidden
        />
        {/* Current position dot */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "w-2.5 h-2.5 rounded-full ring-2 ring-surface-2",
            isUp ? "bg-profit" : "bg-loss"
          )}
          style={{ left: `${clamped * 100}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-caption text-loss/70">Stop</span>
        <span className="text-caption text-profit/70">Hedef</span>
      </div>
    </div>
  );
}
