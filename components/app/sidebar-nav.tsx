"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Import,
  LayoutDashboard,
  PackageMinus,
  Ruler,
  Settings,
  ShoppingCart,
  Shuffle,
  Tags,
  TrendingDown,
  Users,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  items: Boxes,
  categories: Tags,
  units: Ruler,
  suppliers: ShoppingCart,
  customers: Users,
  warehouses: Warehouse,
  goodsReceipts: ArrowDownToLine,
  goodsIssues: ArrowUpFromLine,
  adjustments: ArrowLeftRight,
  transfers: Shuffle,
  opnames: ClipboardCheck,
  stock: PackageMinus,
  movements: Activity,
  lowStock: TrendingDown,
  reports: BarChart3,
  settings: Settings,
  imports: Import,
};

interface NavItem {
  href: string;
  key: string;
  label: string;
  disabled?: boolean;
}

interface NavSection {
  key: string;
  label?: string;
  items: NavItem[];
}

interface SidebarNavProps {
  sections: NavSection[];
  collapseLabels: {
    collapse: string;
    expand: string;
  };
}

export function SidebarNav({ sections, collapseLabels }: SidebarNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("ws39:sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      window.localStorage.setItem("ws39:sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] md:flex md:flex-col",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section, idx) => (
          <div key={section.key} className={cn(idx > 0 && "mt-6")}>
            {section.label && !collapsed ? (
              <h4 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </h4>
            ) : null}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = ICONS[item.key] ?? FileText;
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                if (item.disabled) {
                  return (
                    <li key={item.key}>
                      <span
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50",
                          collapsed && "justify-center px-0",
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {!collapsed ? <span>{item.label}</span> : null}
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-sidebar-foreground hover:bg-muted/70 hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary"
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                        aria-hidden
                      />
                      {!collapsed ? <span>{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? collapseLabels.expand : collapseLabels.collapse}
          title={collapsed ? collapseLabels.expand : collapseLabels.collapse}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <ChevronLeft className="size-4" aria-hidden />
          )}
          {!collapsed ? <span>{collapseLabels.collapse}</span> : null}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({
  sections,
  triggerLabel,
}: {
  sections: NavSection[];
  triggerLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground md:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] animate-slide-down border-r border-border bg-sidebar p-4 shadow-elevated">
            <div className="flex items-center justify-between pb-4">
              <span className="text-sm font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <nav className="space-y-4">
              {sections.map((section) => (
                <div key={section.key}>
                  {section.label ? (
                    <h4 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {section.label}
                    </h4>
                  ) : null}
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = ICONS[item.key] ?? FileText;
                      const active =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                      if (item.disabled) {
                        return (
                          <li key={item.key}>
                            <span className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50">
                              <Icon className="size-4" aria-hidden />
                              {item.label}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              active
                                ? "bg-accent font-medium text-accent-foreground"
                                : "text-foreground hover:bg-muted/70",
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-4",
                                active ? "text-primary" : "text-muted-foreground",
                              )}
                              aria-hidden
                            />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
