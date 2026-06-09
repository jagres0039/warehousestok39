import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        neutral:
          "bg-muted text-foreground ring-1 ring-inset ring-border",
        muted:
          "bg-muted text-muted-foreground",
        success:
          "bg-success/10 text-success ring-1 ring-inset ring-success/20",
        warning:
          "bg-warning/15 text-warning-foreground ring-1 ring-inset ring-warning/30",
        destructive:
          "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
        info:
          "bg-accent text-accent-foreground ring-1 ring-inset ring-primary/15",
        outline:
          "text-foreground ring-1 ring-inset ring-border",
        owner:
          "bg-success/10 text-success ring-1 ring-inset ring-success/20",
        admin:
          "bg-accent text-accent-foreground ring-1 ring-inset ring-primary/15",
        operator:
          "bg-muted text-foreground ring-1 ring-inset ring-border",
        viewer:
          "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };

export function roleBadgeVariant(role: string): NonNullable<BadgeProps["variant"]> {
  switch (role) {
    case "OWNER":
      return "owner";
    case "ADMIN":
      return "admin";
    case "OPERATOR":
      return "operator";
    case "VIEWER":
      return "viewer";
    default:
      return "neutral";
  }
}
