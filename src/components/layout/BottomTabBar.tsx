import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "./nav-config";

/**
 * BottomTabBar — mobile primary navigation.
 *
 * Positioning note: this is NOT `position: fixed`. It's a flex sibling of
 * the scrolling content region inside MainLayout's app shell. The parent
 * shell is height:100dvh and doesn't scroll, so this bar is always pinned
 * to the visual viewport edge — without any of iOS Safari's fixed-element
 * quirks (address-bar jitter, backdrop-filter recomposite lag).
 *
 * The FAB protrudes above the bar via `-mt-5`. The scroll region above
 * leaves a `pb-8` breathing margin so the last row of page content never
 * tucks under the FAB.
 */
export function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const left = PRIMARY_NAV.slice(0, 2);
  const right = PRIMARY_NAV.slice(2);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleAdd = () => {
    navigate("/islemlerim", { state: { openAddTrade: Date.now() } });
  };

  return (
    <nav
      className={cn(
        "md:hidden shrink-0 z-40",
        "bg-background-secondary",
        "border-t border-border-subtle"
      )}
      aria-label="Ana gezinme"
    >
      <div className="pb-safe">
        <ul className="relative h-[var(--tabbar-h)] grid grid-cols-5">
          {left.map((item) => (
            <TabItem key={item.path} item={item} active={isActive(item.path)} />
          ))}

          {/* Center FAB */}
          <li className="flex items-start justify-center pt-1">
            <button
              type="button"
              onClick={handleAdd}
              aria-label="Yeni işlem ekle"
              className={cn(
                "relative -mt-5 w-14 h-14 rounded-full",
                "bg-primary text-primary-foreground",
                "ring-[3px] ring-background-secondary",
                "flex items-center justify-center",
                "active:scale-95 transition-transform",
                "focus-visible:outline-none focus-visible:ring-offset-0 focus-visible:ring-primary/80"
              )}
            >
              <Plus className="w-6 h-6" strokeWidth={2.5} />
            </button>
          </li>

          {right.map((item) => (
            <TabItem key={item.path} item={item} active={isActive(item.path)} />
          ))}
        </ul>
      </div>
    </nav>
  );
}

function TabItem({
  item,
  active,
}: {
  item: (typeof PRIMARY_NAV)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <li className="flex">
      <Link
        to={item.path}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5",
          "relative transition-colors",
          "active:bg-surface-2",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span
          className={cn(
            "absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full transition-colors",
            active ? "bg-primary" : "bg-transparent"
          )}
          aria-hidden
        />
        <Icon
          className="w-[22px] h-[22px]"
          strokeWidth={active ? 2.25 : 1.75}
        />
        <span className="text-[10px] leading-none font-medium tracking-wide">
          {item.shortLabel}
        </span>
      </Link>
    </li>
  );
}
