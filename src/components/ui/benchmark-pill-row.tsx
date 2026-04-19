import { cn } from "@/lib/utils";

/**
 * BenchmarkPillRow — horizontal scrollable multi-select pill row.
 *
 * Same UI on Grafik (price chart benchmarks) and Rapor (equity curve
 * benchmarks). Each pill has a color dot; active pills get a subtle
 * surface swap and a stronger border. Overflow is handled with a
 * horizontal scroll that hides the scrollbar on mobile.
 */

export interface BenchmarkOption<T extends string = string> {
  id: T;
  label: string;
  color: string;
  /** Optional trailing value shown only when active (e.g. scrubbed value). */
  trailing?: React.ReactNode;
}

interface BenchmarkPillRowProps<T extends string> {
  options: BenchmarkOption<T>[];
  selected: Set<T>;
  onToggle: (id: T) => void;
  /** Optional leading pill — used by Rapor's bar chart to toggle "Portföy". */
  leading?: {
    id: string;
    label: string;
    color: string;
    active: boolean;
    onToggle: () => void;
  };
  className?: string;
  /** Bleed out horizontally on mobile so pills reach the edge. Default true. */
  bleedOnMobile?: boolean;
}

export function BenchmarkPillRow<T extends string>({
  options,
  selected,
  onToggle,
  leading,
  className,
  bleedOnMobile = true,
}: BenchmarkPillRowProps<T>) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto no-scrollbar",
        bleedOnMobile && "-mx-3 px-3 md:mx-0 md:px-0",
        className
      )}
    >
      {leading && (
        <Pill
          label={leading.label}
          color={leading.color}
          active={leading.active}
          onClick={leading.onToggle}
        />
      )}
      {options.map((opt) => (
        <Pill
          key={opt.id}
          label={opt.label}
          color={opt.color}
          active={selected.has(opt.id)}
          onClick={() => onToggle(opt.id)}
          trailing={opt.trailing}
        />
      ))}
    </div>
  );
}

function Pill({
  label,
  color,
  active,
  onClick,
  trailing,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-full border transition-colors",
        "text-label",
        active
          ? "bg-surface-3 border-border-strong text-foreground"
          : "bg-surface-1 border-border-subtle text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
      {trailing}
    </button>
  );
}
