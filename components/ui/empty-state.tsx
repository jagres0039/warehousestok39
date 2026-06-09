import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
  children?: React.ReactNode;
}

/**
 * Consistent empty-state placeholder: dashed card with optional icon, title,
 * description, and a primary call-to-action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          className="mb-4 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground ring-1 ring-inset ring-primary/10"
          aria-hidden
        >
          <Icon className="size-6" />
        </span>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        >
          {action.label}
        </Link>
      ) : null}
      {children}
    </div>
  );
}
