import { useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Layers, Scissors } from "lucide-react";
import { MergedClosedTrade } from "@/lib/tradeMerge";
import { useMarketData } from "@/contexts/MarketDataContext";
import { cn } from "@/lib/utils";
import { formatPrice, getSymbolCurrency } from "@/lib/currency";
import { StockLogo } from "@/components/ui/stock-logo";
import { calculateProfitPct } from "@/lib/tradeMerge";

/**
 * ClosedPositionCard — mobile-first card for a merged closed trade.
 *
 * Hierarchy:
 *   1. Symbol + closing badge (Kâr Al / Stop / Karışık) + merge/parts meta
 *   2. Realized P&L prominently displayed
 *   3. Ortalama giriş → ortalama çıkış triad
 *
 * Tappable: opens the closed-trade action sheet upstream.
 */
interface ClosedPositionCardProps {
  merged: MergedClosedTrade;
  onClick: (merged: MergedClosedTrade) => void;
}

export function ClosedPositionCard({ merged, onClick }: ClosedPositionCardProps) {
  const { getStockBySymbol } = useMarketData();
  const marketStock = getStockBySymbol(merged.stock_symbol);
  const currency = getSymbolCurrency(merged.stock_symbol);

  const pnl = merged.total_realized_pnl;
  const isUp = pnl >= 0;
  const profitPct = useMemo(
    () => calculateProfitPct(merged.trade_type, merged.weighted_entry, merged.weighted_exit),
    [merged]
  );

  const closingLabel =
    merged.closing_type_dominant === "kar_al"
      ? "Kâr Al"
      : merged.closing_type_dominant === "stop"
      ? "Stop"
      : "Karışık";

  const closingTone =
    merged.closing_type_dominant === "kar_al"
      ? "bg-profit-soft text-profit"
      : merged.closing_type_dominant === "stop"
      ? "bg-loss-soft text-loss"
      : "bg-surface-3 text-muted-foreground";

  return (
    <button
      type="button"
      onClick={() => onClick(merged)}
      className={cn(
        "w-full text-left rounded-xl p-4",
        "bg-surface-1 border border-border-subtle",
        "hover:bg-surface-2 transition-colors",
        "active:scale-[0.995]"
      )}
    >
      {/* Row 1: Identity */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0 opacity-85">
          <StockLogo
            symbol={merged.stock_symbol}
            logoUrl={marketStock?.logoUrl}
            size="md"
          />
          <span
            className={cn(
              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-2 ring-surface-1",
              "flex items-center justify-center text-[9px] font-bold text-white",
              merged.trade_type === "buy" ? "bg-profit" : "bg-loss"
            )}
            aria-hidden
          >
            {merged.trade_type === "buy" ? "↑" : "↓"}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-title text-foreground">
              {merged.stock_symbol}
            </span>
            <span
              className={cn(
                "text-caption px-1.5 py-0.5 rounded",
                closingTone
              )}
            >
              {closingLabel}
            </span>
            {merged.partial_closes.length > 1 && (
              <span
                className="inline-flex items-center gap-0.5 text-caption px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground"
                title="Parçalı kapanış sayısı"
              >
                <Scissors className="w-2.5 h-2.5" />
                {merged.partial_closes.length}
              </span>
            )}
            {merged.source_trades.length > 1 && (
              <span
                className="inline-flex items-center gap-0.5 text-caption px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground"
                title="Birleşmiş işlem sayısı"
              >
                <Layers className="w-2.5 h-2.5" />
                {merged.source_trades.length}
              </span>
            )}
          </div>
          <div className="text-label text-muted-foreground truncate mt-0.5">
            {merged.stock_name}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-label text-muted-foreground">
            {merged.total_lot} lot
          </div>
          {merged.weighted_rr !== null && (
            <div className="text-caption text-muted-foreground mt-0.5">
              RR{" "}
              <span
                className={cn(
                  "font-mono font-semibold",
                  merged.weighted_rr >= 3 ? "text-profit" : "text-loss"
                )}
              >
                {merged.weighted_rr.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Realized P&L */}
      <div
        className={cn(
          "mt-3 flex items-end justify-between gap-3 p-3 rounded-lg",
          isUp ? "bg-profit-soft" : "bg-loss-soft"
        )}
      >
        <div>
          <div className={cn("text-caption", isUp ? "text-profit" : "text-loss")}>
            Gerçekleşen K/Z
          </div>
          <div
            className={cn(
              "num-lg mt-0.5",
              isUp ? "text-profit" : "text-loss"
            )}
          >
            {isUp ? "+" : "−"}
            {currency === "USD" ? "$" : "₺"}
            {Math.abs(pnl).toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
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
          {profitPct >= 0 ? "+" : ""}
          {profitPct.toFixed(2)}%
        </div>
      </div>

      {/* Row 3: Entry → Exit triad */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <TriadCell
          label="Ort. Giriş"
          value={formatPrice(merged.weighted_entry, currency)}
        />
        <TriadCell
          label="Ort. Çıkış"
          value={formatPrice(merged.weighted_exit, currency)}
          tone={isUp ? "profit" : "loss"}
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
