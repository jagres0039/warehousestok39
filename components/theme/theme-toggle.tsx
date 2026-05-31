"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  label?: string;
}

export function ThemeToggle({ className, label = "Toggle theme" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  function cycle() {
    const order = ["light", "dark", "system"] as const;
    const current = theme === "system" ? "system" : theme === "dark" ? "dark" : "light";
    const idx = order.indexOf(current as (typeof order)[number]);
    const next = order[(idx + 1) % order.length] ?? "system";
    setTheme(next);
  }

  const icon = !mounted ? (
    <Sun className="h-4 w-4" aria-hidden />
  ) : theme === "system" ? (
    <Monitor className="h-4 w-4" aria-hidden />
  ) : resolvedTheme === "dark" ? (
    <Moon className="h-4 w-4" aria-hidden />
  ) : (
    <Sun className="h-4 w-4" aria-hidden />
  );

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {icon}
    </button>
  );
}
