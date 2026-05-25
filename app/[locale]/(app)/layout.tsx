import Link from "next/link";
import { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { signOutAction } from "./actions";

// All protected routes need a live session, so opt out of static generation.
export const dynamic = "force-dynamic";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AppLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("nav");

  const signOutBound = signOutAction.bind(null, locale);
  const otherLocale = locale === "id" ? "en" : "id";

  const navSections: NavSection[] = [
    {
      key: "dashboard",
      items: [{ href: `/${locale}/dashboard`, key: "dashboard" }],
    },
    {
      key: "masterData",
      items: [
        { href: `/${locale}/items`, key: "items" },
        { href: `/${locale}/categories`, key: "categories" },
        { href: `/${locale}/units`, key: "units" },
        { href: `/${locale}/suppliers`, key: "suppliers" },
        { href: `/${locale}/customers`, key: "customers" },
        { href: `/${locale}/warehouses`, key: "warehouses" },
      ],
    },
    {
      key: "transactions",
      items: [
        { href: `/${locale}/goods-receipts`, key: "goodsReceipts" },
        { href: `/${locale}/goods-issues`, key: "goodsIssues" },
        { href: `/${locale}/adjustments`, key: "adjustments" },
      ],
    },
    {
      key: "reports",
      items: [
        { href: `/${locale}/stock`, key: "stock" },
        { href: `/${locale}/reports`, key: "reports", disabled: true },
        { href: `/${locale}/settings`, key: "settings", disabled: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container flex h-14 items-center justify-between">
          <Link
            href={`/${locale}/dashboard`}
            className="text-base font-semibold tracking-tight"
          >
            Warehousestok39
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 md:inline">
              {session.organizationName} · {session.role}
            </span>
            <Link
              href={`/${otherLocale}/dashboard`}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:text-slate-900"
            >
              {otherLocale.toUpperCase()}
            </Link>
            <form action={signOutBound}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="container grid gap-6 py-6 md:grid-cols-[220px,1fr]">
        <aside className="hidden md:block">
          <nav className="space-y-6">
            {navSections.map((section) => (
              <div key={section.key}>
                {section.key !== "dashboard" ? (
                  <h4 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t(section.key)}
                  </h4>
                ) : null}
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.key}>
                      {item.disabled ? (
                        <span className="block cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-slate-400">
                          {t(item.key)}
                        </span>
                      ) : (
                        <Link
                          href={item.href}
                          className="block rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        >
                          {t(item.key)}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

interface NavItem {
  href: string;
  key: NavKey;
  disabled?: boolean;
}

interface NavSection {
  key: NavKey;
  items: NavItem[];
}

type NavKey =
  | "dashboard"
  | "items"
  | "categories"
  | "units"
  | "suppliers"
  | "customers"
  | "warehouses"
  | "goodsReceipts"
  | "goodsIssues"
  | "adjustments"
  | "stock"
  | "reports"
  | "settings"
  | "masterData"
  | "transactions";
