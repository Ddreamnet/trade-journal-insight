import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

interface NumberInputProps extends Omit<React.ComponentProps<"input">, 'type'> {
  onValueChange?: (value: string) => void;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, step = "1", min, max, value, onChange, onValueChange, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    React.useImperativeHandle(ref, () => inputRef.current!);

    const adjustValue = (direction: 'up' | 'down') => {
      const input = inputRef.current;
      if (!input) return;
      
      const currentValue = parseFloat(input.value) || 0;
      const stepValue = parseFloat(step as string) || 1;
      const minValue = min !== undefined ? parseFloat(min as string) : -Infinity;
      const maxValue = max !== undefined ? parseFloat(max as string) : Infinity;
      
      let newValue = direction === 'up' 
        ? currentValue + stepValue 
        : currentValue - stepValue;
      
      // Clamp to min/max
      newValue = Math.max(minValue, Math.min(maxValue, newValue));
      
      // Format to match step precision
      const decimals = (step as string).includes('.') 
        ? (step as string).split('.')[1].length 
        : 0;
      const formattedValue = newValue.toFixed(decimals);
      
      // Trigger onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, formattedValue);
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
      }
      
      if (onValueChange) {
        onValueChange(formattedValue);
      }
    };

    return (
      <div className="relative">
        <input
          type="number"
          ref={inputRef}
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          className={cn(
            "flex h-10 w-full rounded-lg border border-border bg-background-secondary pl-3 pr-10 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 md:text-sm",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            className
          )}
          {...props}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
          <button
            type="button"
            onClick={() => adjustValue('up')}
            className="flex items-center justify-center w-6 h-4 rounded-sm text-muted-foreground hover:text-foreground hover:bg-background-tertiary transition-colors"
            tabIndex={-1}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => adjustValue('down')}
            className="flex items-center justify-center w-6 h-4 rounded-sm text-muted-foreground hover:text-foreground hover:bg-background-tertiary transition-colors"
            tabIndex={-1}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
