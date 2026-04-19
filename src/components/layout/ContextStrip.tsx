import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketData } from "@/contexts/MarketDataContext";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { usePortfolioCash } from "@/hooks/usePortfolioCash";

/**
 * ContextStrip — a compact, market-aware status bar.
 *
 * Shows the BIST100 spot + day change on the left, and the active
 * portfolio's available cash on the right. Sits below the AppHeader
 * and above page content. Scrolls with the page (not sticky) so it
 * doesn't consume vertical real estate on long pages.
 */
export function ContextStrip() {
  const { isAuthenticated } = useAuth();
  const { activeSelection, activePortfolio } = usePortfolioContext();
  const cashFilter =
    typeof activeSelection === "string" && activeSelection !== "all"
      ? activeSelection
      : null;
  const { availableCash, isCashLoading } = usePortfolioCash(cashFilter);
  const { xu100 } = useMarketData();

  return (
    <div className="px-3 md:px-6 pt-3">
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          "h-9 px-3 rounded-full",
          "bg-surface-1 border border-border-subtle"
        )}
      >
        {/* XU100 */}
        <div className="flex items-center gap-1.5 min-w-0">
          {xu100 ? (
            <>
              <span className="text-caption text-muted-foreground shrink-0">
                XU100
              </span>
              <span className="num-sm text-foreground shrink-0">
                {xu100.last.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 num-sm shrink-0",
                  xu100.chgPct >= 0 ? "text-profit" : "text-loss"
                )}
              >
                {xu100.chgPct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {xu100.chgPct >= 0 ? "+" : ""}
                {xu100.chgPct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-caption text-muted-foreground">Piyasa yükleniyor…</span>
          )}
        </div>

        {/* Cash balance (authenticated only) */}
        {isAuthenticated && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-caption text-muted-foreground hidden sm:inline truncate">
              {activePortfolio ? activePortfolio.name : "Toplam"}
            </span>
            <span
              className={cn(
                "num-sm shrink-0",
                availableCash >= 0 ? "text-foreground" : "text-loss"
              )}
            >
              {isCashLoading
                ? "…"
                : `₺${availableCash.toLocaleString("tr-TR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
