import { Home, ListTree, LineChart as ChartIcon, BarChart3 } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}

/**
 * The 4 primary routes of the authed app. Order drives both the bottom
 * tab bar (mobile) and the side rail (desktop).
 *
 * - Ana Sayfa: dashboard / home
 * - İşlemler:  positions + transaction log
 * - Grafik:    dedicated stock chart surface
 * - Rapor:     performance analytics
 */
export const PRIMARY_NAV: NavItem[] = [
  { path: "/",           label: "Ana Sayfa", shortLabel: "Ana",     icon: Home },
  { path: "/islemlerim", label: "İşlemler",  shortLabel: "İşlem",   icon: ListTree },
  { path: "/grafik",     label: "Grafik",    shortLabel: "Grafik",  icon: ChartIcon },
  { path: "/raporlarim", label: "Rapor",     shortLabel: "Rapor",   icon: BarChart3 },
];

/** Helper: the currently-active primary nav item, based on pathname. */
export function getActiveNavItem(pathname: string): NavItem | undefined {
  // Exact match for "/" so it doesn't swallow every route
  if (pathname === "/") return PRIMARY_NAV[0];
  return PRIMARY_NAV.find(
    (n) => n.path !== "/" && pathname.startsWith(n.path)
  );
}
