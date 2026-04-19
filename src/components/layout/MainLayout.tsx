import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { SideRail } from "./SideRail";
import { BottomTabBar } from "./BottomTabBar";
import { ContextStrip } from "./ContextStrip";
import { TickerTape } from "./TickerTape";
import { ManagePortfoliosModal } from "@/components/portfolio/ManagePortfoliosModal";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  hideContext?: boolean;
  hideTicker?: boolean;
  fullBleed?: boolean;
}

/**
 * MainLayout — internal-scroll app shell.
 *
 * Layout model: the outer element is `100dvh` tall and never scrolls.
 * The header (top) and bottom tab bar (mobile) are flex siblings of an
 * inner scrollable region, so they're always anchored to the visible
 * viewport edges without relying on `position: fixed`. This avoids the
 * iOS Safari "address bar jitter" entirely and keeps the chrome rock
 * steady on long pages (Reports, long trade lists).
 *
 * Mobile:
 *   [AppHeader         ] ← fixed at top via flex
 *   [scrollable content] ← this is what actually scrolls
 *   [BottomTabBar      ] ← fixed at bottom via flex
 *
 * Desktop:
 *   [SideRail | [AppHeader        ]]
 *             | [scrollable content]
 */
export function MainLayout({
  children,
  hideContext = false,
  hideTicker = false,
  fullBleed = false,
}: MainLayoutProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const location = useLocation();
  const isChartPage = location.pathname.startsWith("/grafik");

  return (
    <div className="h-[100dvh] flex bg-background text-foreground overflow-hidden">
      {/* Desktop left rail (flex sibling, not fixed) */}
      <SideRail onOpenSettings={() => setManageOpen(true)} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader onOpenSettings={() => setManageOpen(true)} />

        {/* Scrollable region — the ONLY thing that scrolls in the whole app */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {!hideContext && <ContextStrip />}
          {!hideTicker && !isChartPage && <TickerTape />}

          <main
            className={cn(
              "w-full",
              fullBleed ? "px-0" : "px-3 md:px-6",
              "pt-3 pb-8",
              !fullBleed && "max-w-[1200px] mx-auto"
            )}
          >
            {children}
          </main>
        </div>

        {/* Mobile bottom nav (flex sibling, not fixed) */}
        <BottomTabBar />
      </div>

      <ManagePortfoliosModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}
