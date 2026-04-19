import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-[0.9375rem] font-medium",
    "ring-offset-background transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-[0.98] active:transition-transform active:duration-75",
  ].join(" "),
  {
    variants: {
      variant: {
        // Solid primary — confident, unambiguous primary action
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",

        // Neutral secondary — for non-primary but still action-weighted
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-3",

        // Outlined — subtle emphasis, good for lists of equal-weight actions
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-2 hover:border-border-strong",

        // Ghost — least visual weight, for tertiary actions and nav
        ghost:
          "text-foreground hover:bg-surface-2",

        // Destructive
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",

        // Link-style
        link:
          "text-primary underline-offset-4 hover:underline",

        // Trading semantics
        buy:
          "bg-profit text-profit-foreground hover:bg-profit/90",
        sell:
          "bg-loss text-loss-foreground hover:bg-loss/90",
      },
      size: {
        sm: "h-9 px-3",
        default: "h-10 px-4",
        lg: "h-11 px-5",
        xl: "h-12 px-6 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
