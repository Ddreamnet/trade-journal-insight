import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BottomSheet — a mobile-first bottom-anchored dialog.
 *
 * On mobile it slides up from the bottom edge and fills up to 92vh.
 * On desktop (md+) it centers and behaves like a standard dialog,
 * with a comfortable max-width. Built on Radix Dialog so it inherits
 * focus trapping, scroll-locking, and ESC/overlay dismissal.
 */

const BottomSheet = DialogPrimitive.Root;
const BottomSheetTrigger = DialogPrimitive.Trigger;
const BottomSheetClose = DialogPrimitive.Close;
const BottomSheetPortal = DialogPrimitive.Portal;

const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = "BottomSheetOverlay";

interface BottomSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Show drag-handle indicator at top (mobile visual affordance). Default true. */
  showHandle?: boolean;
  /** Hide the close (X) button. Default false. */
  hideCloseButton?: boolean;
  /** Constrain max width on desktop. Default "lg" (32rem). */
  size?: "md" | "lg" | "xl" | "2xl";
}

const sizeClass: Record<NonNullable<BottomSheetContentProps["size"]>, string> = {
  md: "md:max-w-md",
  lg: "md:max-w-lg",
  xl: "md:max-w-xl",
  "2xl": "md:max-w-2xl",
};

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  BottomSheetContentProps
>(({ className, children, showHandle = true, hideCloseButton = false, size = "lg", ...props }, ref) => (
  <BottomSheetPortal>
    <BottomSheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 bg-background-secondary border border-border shadow-lg",
        "flex flex-col",

        // Mobile — bottom-anchored. Slides up from off-screen via the
        // tailwindcss-animate primitives so the animation composes with the
        // static position (no transform override).
        "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-b-0 pb-safe",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:duration-300 data-[state=closed]:duration-200",
        "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",

        // Desktop — centered modal. Uses explicit `translate-x-[-50%]`
        // + `translate-y-[-50%]` so the animation-driven transform
        // composes cleanly (this is the shadcn Dialog pattern). Cancels
        // the mobile bottom-slide (`*-bottom-0`) and uses fade + zoom
        // which don't conflict with the centering translate.
        "md:inset-x-auto md:bottom-auto md:left-[50%] md:top-[50%]",
        "md:translate-x-[-50%] md:translate-y-[-50%]",
        "md:w-[calc(100%-2rem)] md:max-h-[88vh] md:rounded-2xl md:border-b",
        "md:data-[state=open]:slide-in-from-bottom-0",
        "md:data-[state=closed]:slide-out-to-bottom-0",
        "md:data-[state=open]:fade-in-0 md:data-[state=open]:zoom-in-95",
        "md:data-[state=closed]:fade-out-0 md:data-[state=closed]:zoom-out-95",

        sizeClass[size],
        className
      )}
      {...props}
    >
      {showHandle && (
        <div className="md:hidden flex items-center justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      {!hideCloseButton && (
        <DialogPrimitive.Close
          className={cn(
            "absolute right-3 top-3 z-10 h-9 w-9 rounded-full",
            "flex items-center justify-center",
            "text-muted-foreground hover:text-foreground hover:bg-surface-3",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "transition-colors"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Kapat</span>
        </DialogPrimitive.Close>
      )}
      {children}
    </DialogPrimitive.Content>
  </BottomSheetPortal>
));
BottomSheetContent.displayName = "BottomSheetContent";

const BottomSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-5 pt-3 pb-3 shrink-0", className)}
    {...props}
  />
);

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-title", className)}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body text-muted-foreground mt-1", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

const BottomSheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 overflow-y-auto px-5 pb-5", className)}
    {...props}
  />
);

const BottomSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "px-5 py-3 border-t border-border-subtle shrink-0",
      "flex items-center gap-2",
      className
    )}
    {...props}
  />
);

export {
  BottomSheet,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter,
};
