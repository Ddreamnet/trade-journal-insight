import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, LogOut, Settings, PenSquare } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PRIMARY_NAV } from "./nav-config";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

/**
 * SideRail — desktop (md+) primary navigation.
 *
 * Always-visible left rail with:
 *  - Brand mark
 *  - Primary nav (same 4 items as BottomTabBar)
 *  - A distinct primary "Yeni İşlem" action
 *  - Settings + logout at the bottom
 *
 * Width is controlled via the --rail-w token so layout stays synchronized
 * with the main content area.
 */
export function SideRail({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleLogout = async () => {
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

  const handleAdd = () => {
    navigate("/islemlerim", { state: { openAddTrade: Date.now() } });
  };

  return (
    <aside
      className={cn(
        // Flex sibling inside the app shell — not fixed. Owns the left
        // gutter on desktop, hidden on mobile.
        "hidden md:flex shrink-0",
        "flex-col bg-surface-1 border-r border-border-subtle",
        "w-[var(--rail-w)]"
      )}
      aria-label="Ana gezinme"
    >
      {/* Brand */}
      <div className="h-[var(--topbar-h)] px-5 flex items-center border-b border-border-subtle">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="Trade Günlüğü" className="h-8 w-auto" />
        </Link>
      </div>

      {/* Primary action */}
      <div className="px-3 pt-4">
        <Button
          onClick={handleAdd}
          className="w-full gap-2 h-10 shadow-sm"
          variant="default"
        >
          <Plus className="w-4 h-4" />
          Yeni İşlem
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 h-10 px-3 rounded-md",
                    "text-[0.9375rem] font-medium transition-colors",
                    active
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                  )}
                >
                  <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer actions */}
      <div className="px-3 pb-4 pt-2 border-t border-border-subtle flex flex-col gap-1">
        <Link
          to="/panel/blog"
          aria-current={isActive("/panel/blog") ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 h-10 px-3 rounded-md",
            "text-[0.9375rem] font-medium transition-colors",
            isActive("/panel/blog")
              ? "bg-surface-3 text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
          )}
        >
          <PenSquare className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span>Blog</span>
        </Link>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className={cn(
              "flex items-center gap-3 h-10 px-3 rounded-md",
              "text-[0.9375rem] font-medium transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            )}
          >
            <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
            <span>Portföyler</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 h-10 px-3 rounded-md",
            "text-[0.9375rem] font-medium transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-surface-2"
          )}
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span>Çıkış</span>
        </button>
      </div>
    </aside>
  );
}
