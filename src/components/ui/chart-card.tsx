import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ChartCard — premium analytical-chart container.
 *
 * Mobile-first anatomy (what the component enforces):
 *   Row A:  [title          ][title-trailing slot (share, etc.)]
 *           [subtitle                                           ]
 *   Row B:  [headerSlot — full width on mobile, stretch]
 *   Row C:  [chart body — full-bleed on mobile]
 *   Row D:  [footer (pills etc.) — padded]
 *
 * Why the split:
 *   - Titles and their trailing icon actions are stable-width — they never
 *     fight with controls like a 5-option SegmentedControl.
 *   - headerSlot (time range, etc.) gets its own row so it can stretch and
 *     remain touch-friendly without squeezing the title.
 *   - Body goes edge-to-edge on mobile so the chart gets maximum width.
 *
 * Desktop (md+) collapses Row A and Row B into a single justified row when
 * the control is compact enough, matching a traditional card header.
 */

export interface ChartCardProps {
  title: React.ReactNode;
  /** Compact live meta or icon slot to the right of the title (share button, live value). */
  titleTrailing?: React.ReactNode;
  /** Secondary line under the title. */
  subtitle?: React.ReactNode;
  /**
   * Controls row — gets its own line on mobile. On desktop it stretches
   * alongside the title when it fits.
   */
  headerSlot?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;

  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsedSlot?: React.ReactNode;

  className?: string;
}

export const ChartCard = React.forwardRef<HTMLElement, ChartCardProps>(
  function ChartCard(
    {
      title,
      titleTrailing,
      subtitle,
      headerSlot,
      children,
      footer,
      collapsible = false,
      defaultOpen = true,
      open: controlledOpen,
      onOpenChange,
      collapsedSlot,
      className,
    },
    ref
  ) {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? (controlledOpen as boolean) : internalOpen;

    const toggle = () => {
      const next = !isOpen;
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    };

    // Title block — used in both collapsible and non-collapsible forms.
    const titleBlock = (
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-title text-foreground truncate flex-1 min-w-0">
            {title}
          </h2>
          {collapsible && (
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                isOpen && "rotate-180"
              )}
              aria-hidden
            />
          )}
        </div>
        {subtitle && (
          <p className="text-label text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    );

    return (
      <section
        ref={ref}
        className={cn(
          "rounded-2xl bg-surface-1 border border-border-subtle overflow-hidden",
          className
        )}
      >
        {/* ── Row A: title + trailing icon ─────────────────────── */}
        <div className="px-4 md:px-5 pt-4 pb-2 md:pb-3">
          {collapsible ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={isOpen}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-3">
                {titleBlock}
                {titleTrailing && (
                  <div
                    className="shrink-0 flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {titleTrailing}
                  </div>
                )}
              </div>
            </button>
          ) : (
            <div className="flex items-start justify-between gap-3">
              {titleBlock}
              {titleTrailing && (
                <div className="shrink-0 flex items-center">{titleTrailing}</div>
              )}
            </div>
          )}
        </div>

        {/* ── Row B: header controls, stretch on mobile ─────────── */}
        {isOpen && headerSlot && (
          <div className="px-4 md:px-5 pb-3">{headerSlot}</div>
        )}

        {/* ── Row C: chart body (full-bleed on mobile) ──────────── */}
        {isOpen && children && (
          <div className="pb-3 md:px-3 md:pb-4">{children}</div>
        )}

        {/* ── Row D: footer (pills, misc) ───────────────────────── */}
        {isOpen && footer && (
          <div className="px-4 md:px-5 pb-4 pt-3 border-t border-border-subtle">
            {footer}
          </div>
        )}

        {/* ── Collapsed teaser ─────────────────────────────────── */}
        {!isOpen && collapsedSlot && (
          <div className="px-4 md:px-5 pb-4">{collapsedSlot}</div>
        )}
      </section>
    );
  }
);
