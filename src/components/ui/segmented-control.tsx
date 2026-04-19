import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SegmentedControl — pill-style grouped selector for short option lists.
 *
 * Use for timeframe pickers (1G / 1H / 1A / 3A / 1Y / Tümü), closing type
 * (Kar Al / Stop), and similar binary/small-N choices. Renders in a single
 * row with comfortable touch targets (40px) and an animated active pill.
 *
 * Fully keyboard-accessible via arrow keys and roving-tabindex semantics.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Optional leading icon (Lucide component or similar) */
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  /** Compact mode: smaller height (32px), for inline use. */
  size?: "sm" | "md";
  /** Equal-width segments (default) or content-sized. */
  stretch?: boolean;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  stretch = true,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowLeft" ? -1 : 1;
    let nextIndex = index + dir;
    // Skip disabled
    while (
      nextIndex >= 0 &&
      nextIndex < options.length &&
      options[nextIndex].disabled
    ) {
      nextIndex += dir;
    }
    if (nextIndex < 0) nextIndex = options.length - 1;
    if (nextIndex >= options.length) nextIndex = 0;
    refs.current[nextIndex]?.focus();
    const next = options[nextIndex];
    if (next && !next.disabled) onChange(next.value);
  };

  const heightClass = size === "sm" ? "h-8" : "h-10";
  const itemHeight = size === "sm" ? "h-[26px]" : "h-[34px]";
  const px = size === "sm" ? "px-2.5" : "px-3.5";
  const textClass = size === "sm" ? "text-xs" : "text-[0.8125rem]";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full bg-surface-2 border border-border-subtle p-1",
        heightClass,
        stretch ? "w-full" : "w-auto",
        className
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => !opt.disabled && onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full font-medium",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              stretch ? "flex-1" : "",
              itemHeight,
              px,
              textClass,
              active
                ? "bg-surface-3 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
