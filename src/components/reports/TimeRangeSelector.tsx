import { TimeRange, TIME_RANGES } from '@/types/trade';
import { cn } from '@/lib/utils';

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onSelect: (range: TimeRange) => void;
}

export function TimeRangeSelector({ selectedRange, onSelect }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-lg">
      {TIME_RANGES.map((range) => (
        <button
          key={range.id}
          onClick={() => onSelect(range.id)}
          className={cn(
            'px-3 py-2 rounded-md text-sm font-medium transition-all',
            selectedRange === range.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
