import { useMemo } from "react";
import { Wallet, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/ui/page-header";
import { StatRow, StatRowGroup } from "@/components/ui/stat-row";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useTrades } from "@/hooks/useTrades";
import { usePortfolioCash } from "@/hooks/usePortfolioCash";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { useMarketData } from "@/contexts/MarketDataContext";

/**
 * Ana Sayfa — a single-glance "how much do I have right now?" card.
 *
 * Deliberately minimal: just the hero summary of total portfolio value and
 * its composition (available cash + open-position market value + unrealized
 * P&L). Detail views live on their own tabs (İşlemler, Grafik, Rapor) and
 * don't need to be mirrored here.
 */
export default function Index() {
  const { activeSelection, activePortfolio } = usePortfolioContext();
  const { getStockBySymbol } = useMarketData();
  const { activeTrades, isLoading } = useTrades();

  // Scope cash to current selection (aligns with ContextStrip behavior)
  const cashFilter =
    typeof activeSelection === "string" && activeSelection !== "all"
      ? activeSelection
      : null;
  const { availableCash, isCashLoading } = usePortfolioCash(cashFilter);

  const scopedActive = useMemo(() => {
    if (activeSelection === "all" || activeSelection === null) return activeTrades;
    return activeTrades.filter((t) => t.portfolio_id === activeSelection);
  }, [activeTrades, activeSelection]);

  const { openMarketValue, unrealizedPnl, missingPrices } = useMemo(() => {
    let mv = 0;
    let pnl = 0;
    let missing = 0;
    for (const t of scopedActive) {
      const stock = getStockBySymbol(t.stock_symbol);
      if (!stock) {
        mv += t.entry_price * t.remaining_lot;
        missing += 1;
        continue;
      }
      const cp = stock.last;
      mv += cp * t.remaining_lot;
      const sign = t.trade_type === "buy" ? 1 : -1;
      pnl += sign * (cp - t.entry_price) * t.remaining_lot;
    }
    return { openMarketValue: mv, unrealizedPnl: pnl, missingPrices: missing };
  }, [scopedActive, getStockBySymbol]);

  const totalValue = availableCash + openMarketValue;
  const scopeLabel = activePortfolio ? activePortfolio.name : "Tüm portföyler";

  return (
    <MainLayout>
      <PageHeader title="Ana Sayfa" description={scopeLabel} spacing="md" />

      {/* Özet — total value with breakdown */}
      <section className="mb-4">
        <div
          className={cn(
            "rounded-2xl p-5 md:p-6",
            "bg-surface-2 border border-border",
            "shadow-sm"
          )}
        >
          <div className="text-label text-muted-foreground">Toplam Değer</div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            {isLoading || isCashLoading ? (
              <Skeleton className="h-10 w-60" />
            ) : (
              <span className="num-display text-foreground">
                ₺
                {totalValue.toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
            {!isLoading && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-label",
                  unrealizedPnl >= 0
                    ? "bg-profit-soft text-profit"
                    : "bg-loss-soft text-loss"
                )}
              >
                {unrealizedPnl >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span className="font-mono font-semibold">
                  {unrealizedPnl >= 0 ? "+" : "−"}₺
                  {Math.abs(unrealizedPnl).toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>

          <StatRowGroup className="mt-5 bg-transparent border-0 px-0">
            <StatRow
              label="Kullanılabilir nakit"
              value={`₺${availableCash.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              dense
              icon={Wallet}
            />
            <StatRow
              label="Açık pozisyon değeri"
              value={`₺${openMarketValue.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              sub={
                missingPrices > 0
                  ? `${missingPrices} hisse için anlık fiyat yok`
                  : undefined
              }
              dense
              icon={Activity}
            />
          </StatRowGroup>
        </div>
      </section>
    </MainLayout>
  );
}
