import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StatRow — label/value/delta row for dense data lists.
 *
 * Typical use inside summary cards, trade detail sheets, reports:
 *   <StatRow label="Giriş" value="₺45.23" />
 *   <StatRow label="Kâr" value="+₺2.130" tone="profit" />
 *
 * Label sits on the left in muted label type. Value is right-aligned
 * and uses mono numerals. Tone controls value color and any delta.
 */

interface StatRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional secondary value on a second line, right-aligned, muted. */
  sub?: React.ReactNode;
  /** Color semantic for the value: none (default), profit, loss, muted. */
  tone?: "default" | "profit" | "loss" | "muted";
  /** Value typography: mono (default, for numbers), text (for labels). */
  valueType?: "mono" | "text";
  /** Dense: reduce vertical padding (for tightly packed lists). */
  dense?: boolean;
  className?: string;
  /** Optional leading icon on the label side. */
  icon?: React.ComponentType<{ className?: string }>;
}

export function StatRow({
  label,
  value,
  sub,
  tone = "default",
  valueType = "mono",
  dense = false,
  className,
  icon: Icon,
}: StatRowProps) {
  const toneClass =
    tone === "profit"
      ? "text-profit"
      : tone === "loss"
      ? "text-loss"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        dense ? "py-1.5" : "py-2.5",
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-label text-muted-foreground min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-right shrink-0">
        <div
          className={cn(
            valueType === "mono" ? "num" : "text-body font-medium",
            toneClass
          )}
        >
          {value}
        </div>
        {sub && (
          <div className="text-caption text-muted-foreground mt-0.5">{sub}</div>
        )}
      </div>
    </div>
  );
}

/**
 * StatRowGroup — visually groups several StatRows inside a single surface.
 * Adds subtle dividers between rows.
 */
export function StatRowGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface-1 px-4",
        className
      )}
    >
      {children}
    </div>
  );
}
