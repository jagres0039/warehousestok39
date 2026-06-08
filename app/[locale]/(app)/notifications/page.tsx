import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Bell, AlertTriangle, Clock } from "lucide-react";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NotificationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("notifications");

  const rows = await prisma.notification.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ isResolved: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      item: { select: { id: true, sku: true, name: true } },
      batch: { select: { id: true, batchCode: true, expiryDate: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Bell className="size-6" />
              <p className="text-sm">{t("empty")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t("colType")}</th>
                    <th className="px-3 py-2">{t("colAlert")}</th>
                    <th className="px-3 py-2">{t("colSeverity")}</th>
                    <th className="px-3 py-2">{t("colCreatedAt")}</th>
                    <th className="px-3 py-2">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((n) => {
                    const href = n.item
                      ? n.batch
                        ? `/${locale}/items/${n.item.id}/batches`
                        : `/${locale}/items/${n.item.id}/card`
                      : null;
                    return (
                      <tr key={n.id}>
                        <td className="px-3 py-2">
                          {n.type === "LOW_STOCK" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <AlertTriangle className="size-3.5 text-amber-600" />
                              {t("typeLowStock")}
                            </span>
                          ) : n.type === "EXPIRED" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <Clock className="size-3.5 text-destructive" />
                              {t("typeExpired")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <Clock className="size-3.5 text-amber-600" />
                              {t("typeExpiringSoon")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {href ? (
                            <Link
                              href={href}
                              className="font-medium hover:underline"
                            >
                              {n.title}
                            </Link>
                          ) : (
                            <span className="font-medium">{n.title}</span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              n.severity === "CRITICAL"
                                ? "destructive"
                                : n.severity === "WARNING"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {n.severity}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {n.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {n.isResolved ? (
                            <Badge variant="success">{t("statusResolved")}</Badge>
                          ) : n.isRead ? (
                            <Badge variant="muted">{t("statusRead")}</Badge>
                          ) : (
                            <Badge variant="info">{t("statusUnread")}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
