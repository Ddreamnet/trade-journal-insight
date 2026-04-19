import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MetricCard — headline numeric card for hero metrics (portfolio value,
 * today's P&L, total realized, etc.). Three sizes; optional delta badge
 * and optional trailing slot (e.g. sparkline, icon, "see details" chevron).
 *
 * Numbers are always mono. Delta uses profit/loss semantics.
 */

export interface MetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small secondary value (e.g. "USD karşılığı $1,234"). */
  sub?: React.ReactNode;
  /**
   * Optional delta — number or string. Numbers get +/− sign + color;
   * strings are rendered as-is.
   */
  delta?: number | string | null;
  /** When delta is a number, an optional percentage shown next to it. */
  deltaPct?: number | null;
  /** "up" / "down" / "flat" — overrides auto-detection from number delta. */
  deltaDirection?: "up" | "down" | "flat";
  /** Prefix/suffix for the delta number (e.g. "₺"). */
  deltaPrefix?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Element rendered on the right side (sparkline, etc). */
  trailing?: React.ReactNode;
  /**
   * Visual emphasis:
   * - "flat": subtle surface, for secondary metrics
   * - "raised": default — a clearly defined card
   * - "hero": extra prominence, large display number, for the primary metric
   */
  variant?: "flat" | "raised" | "hero";
  className?: string;
  onClick?: () => void;
  /** When true, a subtle hover/press affordance is rendered. */
  interactive?: boolean;
}

export function MetricCard({
  label,
  value,
  sub,
  delta,
  deltaPct,
  deltaDirection,
  deltaPrefix,
  icon: Icon,
  trailing,
  variant = "raised",
  className,
  onClick,
  interactive,
}: MetricCardProps) {
  // Auto-detect direction from numeric delta
  let dir: "up" | "down" | "flat" = "flat";
  if (deltaDirection) {
    dir = deltaDirection;
  } else if (typeof delta === "number") {
    dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  }

  const deltaColor =
    dir === "up"
      ? "text-profit"
      : dir === "down"
      ? "text-loss"
      : "text-muted-foreground";

  const DeltaIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : null;

  const formatNumber = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const surfaceClass =
    variant === "flat"
      ? "bg-surface-1 border border-border-subtle"
      : variant === "hero"
      ? "bg-surface-2 border border-border shadow-sm"
      : "bg-surface-2 border border-border-subtle";

  const padding =
    variant === "hero" ? "p-5" : "p-4";

  const valueClass =
    variant === "hero"
      ? "num-display text-foreground"
      : "num-lg text-foreground";

  const Root: React.ElementType = onClick || interactive ? "button" : "div";

  return (
    <Root
      onClick={onClick}
      className={cn(
        "block w-full text-left rounded-xl",
        surfaceClass,
        padding,
        (onClick || interactive) &&
          "hover:bg-surface-3 active:scale-[0.995] transition-colors cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-label text-muted-foreground">
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span className="truncate">{label}</span>
          </div>
          <div className={cn("mt-1", valueClass)}>{value}</div>
          {sub && (
            <div className="mt-0.5 text-caption text-muted-foreground">
              {sub}
            </div>
          )}
          {(delta !== null && delta !== undefined) && (
            <div className={cn("mt-2 inline-flex items-center gap-1 text-label", deltaColor)}>
              {DeltaIcon && <DeltaIcon className="w-3.5 h-3.5" />}
              <span className="font-mono font-medium">
                {typeof delta === "number"
                  ? `${delta >= 0 ? "+" : "−"}${deltaPrefix ?? ""}${formatNumber(Math.abs(delta))}`
                  : delta}
              </span>
              {typeof deltaPct === "number" && (
                <span className="font-mono font-medium">
                  ({deltaPct >= 0 ? "+" : ""}
                  {deltaPct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </Root>
  );
}
