import Link from "next/link";
import { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Boxes } from "lucide-react";
import { requireTenantSession } from "@/lib/session";
import { signOutAction } from "./actions";
import { SidebarNav, MobileNav } from "@/components/app/sidebar-nav";
import { canAdminister } from "@/lib/role-guard";
import { UserMenu } from "@/components/app/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge, roleBadgeVariant } from "@/components/ui/badge";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { prisma } from "@/lib/prisma";

// All protected routes need a live session, so opt out of static generation.
export const dynamic = "force-dynamic";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

interface NavSectionDef {
  key: string;
  labelKey?: string;
  items: { href: string; key: string; disabled?: boolean }[];
}

export default async function AppLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("nav");

  const signOutBound = signOutAction.bind(null, locale);
  const otherLocale = locale === "id" ? "en" : "id";

  const navDef: NavSectionDef[] = [
    {
      key: "dashboard",
      items: [{ href: `/${locale}/dashboard`, key: "dashboard" }],
    },
    {
      key: "masterData",
      labelKey: "masterData",
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
      labelKey: "transactions",
      items: [
        { href: `/${locale}/goods-receipts`, key: "goodsReceipts" },
        { href: `/${locale}/goods-issues`, key: "goodsIssues" },
        { href: `/${locale}/adjustments`, key: "adjustments" },
        { href: `/${locale}/transfers`, key: "transfers" },
        { href: `/${locale}/opnames`, key: "opnames" },
      ],
    },
    {
      key: "reports",
      labelKey: "reports",
      items: [
        { href: `/${locale}/stock`, key: "stock" },
        { href: `/${locale}/reports/movements`, key: "movements" },
        { href: `/${locale}/reports/low-stock`, key: "lowStock" },
        { href: `/${locale}/reports/expiring-soon`, key: "expiringSoon" },
        { href: `/${locale}/reports`, key: "reports" },
        { href: `/${locale}/notifications`, key: "notifications" },
        { href: `/${locale}/settings`, key: "settings" },
      ],
    },
  ];

  // Admin-only section: bulk import. Hidden from OPERATOR/VIEWER so they
  // don't see a link they can't open. The page itself also gates via
  // assertCanAdminister, so this is just polish.
  if (canAdminister(session.role)) {
    navDef.push({
      key: "administration",
      labelKey: "administration",
      items: [{ href: `/${locale}/imports`, key: "imports" }],
    });
  }

  // Bell-icon initial payload: unread count + the latest 10 notifications
  // (ordered by isRead asc, createdAt desc) so unread alerts appear first.
  const [unreadCount, recent] = await Promise.all([
    prisma.notification.count({
      where: {
        organizationId: session.organizationId,
        isRead: false,
        isResolved: false,
      },
    }),
    prisma.notification.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      take: 10,
      include: {
        item: { select: { id: true, sku: true } },
        batch: { select: { id: true } },
      },
    }),
  ]);

  const notificationItems = recent.map((n) => ({
    id: n.id,
    type: n.type,
    severity: n.severity,
    title: n.title,
    body: n.body,
    href: n.item
      ? n.batch
        ? `/${locale}/items/${n.item.id}/batches`
        : `/${locale}/items/${n.item.id}/card`
      : null,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  const sections = navDef.map((section) => ({
    key: section.key,
    label: section.labelKey ? t(section.labelKey) : undefined,
    items: section.items.map((it) => ({
      href: it.href,
      key: it.key,
      label: t(it.key),
      disabled: it.disabled,
    })),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <MobileNav sections={sections} triggerLabel={t("openMenu")} />
            <Link
              href={`/${locale}/dashboard`}
              className="flex items-center gap-2 text-base font-semibold tracking-tight"
            >
              <span
                className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft"
                aria-hidden
              >
                <Boxes className="size-4" />
              </span>
              <span className="hidden sm:inline">Warehousestok39</span>
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-background py-1 pl-3 pr-1 text-xs sm:flex">
              <span className="font-medium text-foreground">
                {session.organizationName}
              </span>
              <Badge variant={roleBadgeVariant(session.role)}>{session.role}</Badge>
            </div>
            <Link
              href={`/${otherLocale}/dashboard`}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Switch to ${otherLocale.toUpperCase()}`}
            >
              {otherLocale.toUpperCase()}
            </Link>
            <ThemeToggle label={t("themeToggle")} />
            <NotificationsBell
              locale={locale}
              initialUnread={unreadCount}
              initialItems={notificationItems}
            />
            <UserMenu
              name={session.name || session.email}
              email={session.email}
              role={session.role}
              settingsHref={`/${locale}/settings`}
              settingsLabel={t("settings")}
              signOutLabel={t("signOut")}
              signOutAction={signOutBound}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <SidebarNav
          sections={sections}
          collapseLabels={{
            collapse: t("collapseSidebar"),
            expand: t("expandSidebar"),
          }}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
