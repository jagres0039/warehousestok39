"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, Loader2 } from "lucide-react";
import { runStockAlertCheckAction } from "@/app/[locale]/(app)/notifications/actions";

interface Props {
  locale: string;
}

interface LastResult {
  created: number;
  resolved: number;
  total: number;
}

export function StockAlertsCheckButton({ locale }: Props) {
  const t = useTranslations("notifications");
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<LastResult | null>(null);

  const handleClick = () => {
    startTransition(async () => {
      try {
        const res = await runStockAlertCheckAction(locale);
        setLast({
          created: res.alertsCreated,
          resolved: res.alertsResolved,
          total: res.alertsTotalToday,
        });
      } catch {
        // Permission errors are surfaced via the action's thrown error;
        // we intentionally swallow so the dashboard does not crash. Result
        // remains the previous one.
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-soft transition hover:bg-muted disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Bell className="size-4" aria-hidden />
        )}
        {pending ? t("checkRunning") : t("checkNow")}
      </button>
      {last ? (
        <span className="text-xs text-muted-foreground">
          {t("checkSummary", {
            created: last.created,
            resolved: last.resolved,
            total: last.total,
          })}
        </span>
      ) : null}
    </div>
  );
}
