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

  const navItems: { href: string; key: keyof IntlNav }[] = [
    { href: `/${locale}/dashboard`, key: "dashboard" },
    { href: `/${locale}/items`, key: "items" },
    { href: `/${locale}/goods-receipts`, key: "goodsReceipts" },
    { href: `/${locale}/goods-issues`, key: "goodsIssues" },
    { href: `/${locale}/adjustments`, key: "adjustments" },
    { href: `/${locale}/reports`, key: "reports" },
    { href: `/${locale}/settings`, key: "settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/dashboard`}
              className="text-base font-semibold tracking-tight"
            >
              Warehousestok39
            </Link>
            <nav className="hidden gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 md:inline">
              {session.organizationName}
            </span>
            <Link
              href={`/${otherLocale}/dashboard`}
              className="text-slate-500 hover:text-slate-900"
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
      <main className="container py-8">{children}</main>
    </div>
  );
}

type IntlNav = {
  dashboard: string;
  items: string;
  goodsReceipts: string;
  goodsIssues: string;
  adjustments: string;
  reports: string;
  settings: string;
  signOut: string;
};
