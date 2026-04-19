import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PageHeader — consistent title block used at the top of each route.
 *
 * Layout:
 *   [ Title           ] [ trailing actions ]
 *   [ description                          ]
 *
 * Do not use inside bottom sheets or dialogs — this is page chrome.
 */

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot for buttons, filters, segmented controls. */
  actions?: React.ReactNode;
  className?: string;
  /** Bottom padding. Default "md". */
  spacing?: "sm" | "md" | "lg";
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  spacing = "md",
}: PageHeaderProps) {
  const spaceClass =
    spacing === "sm" ? "mb-3" : spacing === "lg" ? "mb-6" : "mb-4";

  return (
    <div className={cn("flex items-start justify-between gap-3", spaceClass, className)}>
      <div className="min-w-0">
        <h1 className="text-title-lg text-foreground truncate">{title}</h1>
        {description && (
          <p className="text-body text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
