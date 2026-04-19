import { TimeRange, TIME_RANGES } from '@/types/trade';
import { SegmentedControl } from '@/components/ui/segmented-control';

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onSelect: (range: TimeRange) => void;
}

/**
 * TimeRangeSelector — thin adapter over the shared SegmentedControl.
 *
 * Kept as a separate component because it has its own semantic meaning
 * (time range) and predefined option set from `TIME_RANGES`. Internally
 * delegates to SegmentedControl so every chart inherits the same visual
 * language without touching the chart files.
 */
export function TimeRangeSelector({ selectedRange, onSelect }: TimeRangeSelectorProps) {
  return (
    <SegmentedControl
      value={selectedRange}
      onChange={(v) => onSelect(v as TimeRange)}
      options={TIME_RANGES.map((r) => ({ value: r.id, label: r.label }))}
      size="sm"
      stretch={false}
      aria-label="Zaman aralığı"
    />
  );
}
