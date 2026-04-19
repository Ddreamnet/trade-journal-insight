import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, LogOut, Settings, PenSquare } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PortfolioSelector } from "@/components/portfolio/PortfolioSelector";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * AppHeader — the top strip that sits above content on both mobile and
 * desktop.
 *
 * Mobile: brand (logo) + portfolio selector + secondary-action menu
 * (settings/logout) since the BottomTabBar owns primary nav.
 *
 * Desktop: the SideRail owns the brand, primary nav, settings, and logout.
 * The header here is therefore minimal — just the portfolio selector.
 * The hamburger menu is hidden on md+ because it would duplicate the rail.
 *
 * Height is driven by --topbar-h (56px).
 */
export function AppHeader({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    setMenuOpen(false);
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Çıkış yapılamadı",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/login");
    }
  };

  return (
    <header
      className={cn(
        // Flex sibling inside the app shell — not sticky/fixed. The shell
        // itself is height:100dvh + overflow-hidden, so this bar is always
        // at the visible viewport top without any scroll-driven jitter.
        "shrink-0 z-30",
        "h-[var(--topbar-h)]",
        "bg-background border-b border-border-subtle"
      )}
    >
      <div className="h-full w-full px-3 md:px-6 flex items-center gap-3">
        {/* Brand — mobile only (desktop uses SideRail for brand) */}
        <Link to="/" className="md:hidden flex items-center shrink-0">
          <img src={logo} alt="Trade Günlüğü" className="h-8 w-auto" />
        </Link>

        {/* Portfolio selector — the global portfolio context switcher */}
        <div className="flex-1 min-w-0 flex items-center">
          <PortfolioSelector className="w-full md:w-64 max-w-xs" />
        </div>

        {/* Profile / settings menu — mobile only; desktop uses SideRail. */}
        <div className="md:hidden">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menü"
                className="shrink-0"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onOpenSettings && (
                <DropdownMenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Portföyleri Yönet
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/panel/blog");
                }}
              >
                <PenSquare className="w-4 h-4 mr-2" />
                Blog
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
