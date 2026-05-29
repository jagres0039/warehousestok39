import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        neutral:
          "border-border bg-muted text-foreground",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        success:
          "border-transparent bg-success/10 text-success",
        warning:
          "border-transparent bg-warning/15 text-warning-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        info:
          "border-transparent bg-accent text-accent-foreground",
        outline:
          "border-border text-foreground",
        owner:
          "border-transparent bg-success/10 text-success",
        admin:
          "border-transparent bg-accent text-accent-foreground",
        operator:
          "border-transparent bg-muted text-foreground",
        viewer:
          "border-transparent bg-muted text-muted-foreground",
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
