"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Clock, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/[locale]/(app)/notifications/actions";

export interface NotificationItem {
  id: string;
  type: "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED";
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Props {
  locale: string;
  initialUnread: number;
  initialItems: NotificationItem[];
}

export function NotificationsBell({ locale, initialUnread, initialItems }: Props) {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-notifications-bell]")) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open]);

  function handleMarkOne(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isRead: true } : it)),
    );
    setUnread((u) => Math.max(0, u - 1));
    startTransition(async () => {
      await markNotificationReadAction(id, locale);
    });
  }

  function handleMarkAll() {
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsReadAction(locale);
    });
  }

  return (
    <div className="relative" data-notifications-bell>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={t("openNotifications")}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{t("title")}</span>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={pending || unread === 0}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck className="size-3.5" />
              {t("markAllRead")}
            </button>
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`flex gap-2 px-3 py-2 ${it.isRead ? "" : "bg-muted/40"}`}
                >
                  <div className="mt-0.5">
                    {it.type === "LOW_STOCK" ? (
                      <AlertTriangle
                        className={`size-4 ${
                          it.severity === "CRITICAL"
                            ? "text-destructive"
                            : "text-amber-600"
                        }`}
                      />
                    ) : (
                      <Clock
                        className={`size-4 ${
                          it.severity === "CRITICAL"
                            ? "text-destructive"
                            : "text-amber-600"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {it.href ? (
                      <Link
                        href={it.href}
                        className="block text-sm font-medium hover:underline"
                        onClick={() => {
                          if (!it.isRead) handleMarkOne(it.id);
                          setOpen(false);
                        }}
                      >
                        {it.title}
                      </Link>
                    ) : (
                      <span className="block text-sm font-medium">{it.title}</span>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {it.body}
                    </p>
                  </div>
                  {!it.isRead ? (
                    <button
                      type="button"
                      onClick={() => handleMarkOne(it.id)}
                      className="self-start text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      aria-label={t("markRead")}
                    >
                      {t("markRead")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-3 py-2">
            <Link
              href={`/${locale}/notifications`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => setOpen(false)}
            >
              {t("viewAll")} →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
