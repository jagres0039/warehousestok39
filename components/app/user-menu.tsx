"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  name: string;
  email?: string;
  role: string;
  settingsHref: string;
  settingsLabel: string;
  signOutLabel: string;
  signOutAction: () => void | Promise<void>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function UserMenu({
  name,
  email,
  role,
  settingsHref,
  settingsLabel,
  signOutLabel,
  signOutAction,
}: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span
          className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          aria-hidden
        >
          {initials(name)}
        </span>
        <span className="hidden text-sm font-medium text-foreground md:inline">
          {name.split(" ")[0]}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 origin-top-right animate-slide-down rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-elevated"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <span
              className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              aria-hidden
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              {email ? (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              ) : null}
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {role}
              </p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href={settingsHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            <SettingsIcon className="size-4 text-muted-foreground" aria-hidden />
            {settingsLabel}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" aria-hidden />
              {signOutLabel}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
