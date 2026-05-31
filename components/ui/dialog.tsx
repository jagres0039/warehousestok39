"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** When false, clicking the backdrop or pressing Escape does NOT close. */
  dismissible?: boolean;
  className?: string;
  closeLabel?: string;
}

/**
 * Minimal accessible modal dialog. Renders a fixed full-screen overlay plus
 * a centered card. No portal — Next.js sees this as part of the parent tree.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
  className,
  closeLabel = "Close",
}: DialogProps) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
      aria-describedby={description ? "dialog-description" : undefined}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (dismissible) onClose();
        }}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground shadow-elevated",
          className,
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="space-y-1">
              {title && (
                <h2 id="dialog-title" className="text-base font-semibold leading-none">
                  {title}
                </h2>
              )}
              {description && (
                <p id="dialog-description" className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="-mr-2 -mt-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
