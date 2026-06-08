import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStockOnHandPerBatch } from "@/lib/inventory";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

function formatDate(d: Date | null, locale: string) {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

export default async function ItemBatchesPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("batches");
  const tCommon = await getTranslations("common");

  const item = await prisma.item.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      id: true,
      sku: true,
      name: true,
      tracksBatch: true,
      unit: { select: { code: true } },
    },
  });
  if (!item) notFound();

  const [batches, onHandRows] = await Promise.all([
    prisma.itemBatch.findMany({
      where: { organizationId: session.organizationId, itemId: id },
      orderBy: [{ expiryDate: "asc" }, { batchCode: "asc" }],
      select: {
        id: true,
        batchCode: true,
        mfgDate: true,
        expiryDate: true,
        isActive: true,
      },
    }),
    getStockOnHandPerBatch(session.organizationId, { itemId: id }),
  ]);

  // Aggregate on-hand per batch across all warehouses.
  const onHandByBatch = new Map<string | null, number>();
  for (const r of onHandRows) {
    const key = r.batchId;
    onHandByBatch.set(key, (onHandByBatch.get(key) ?? 0) + r.qty);
  }

  const now = Date.now();
  const soonMs = 30 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/items`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {tCommon("back")}
        </Link>
        <PageHeader
          title={`${t("pageTitle")}: ${item.sku}`}
          description={t("pageDescription", { item: item.name })}
        />
      </div>

      {!item.tracksBatch ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("notTracked")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("tableTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {batches.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("noBatches")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">{t("colBatchCode")}</th>
                      <th className="px-4 py-2 font-medium">{t("colMfgDate")}</th>
                      <th className="px-4 py-2 font-medium">{t("colExpiryDate")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("colOnHand")}</th>
                      <th className="px-4 py-2 font-medium">{t("colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => {
                      const onHand = onHandByBatch.get(b.id) ?? 0;
                      let statusLabel = t("statusActive");
                      let statusVariant: "success" | "muted" | "warning" | "destructive" = "success";
                      if (!b.isActive) {
                        statusLabel = t("statusInactive");
                        statusVariant = "muted";
                      } else if (b.expiryDate) {
                        const diff = b.expiryDate.getTime() - now;
                        if (diff <= 0) {
                          statusLabel = t("statusExpired");
                          statusVariant = "destructive";
                        } else if (diff <= soonMs) {
                          statusLabel = t("statusExpiringSoon");
                          statusVariant = "warning";
                        }
                      }
                      return (
                        <tr key={b.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 font-mono text-xs">{b.batchCode}</td>
                          <td className="px-4 py-2">{formatDate(b.mfgDate, locale)}</td>
                          <td className="px-4 py-2">{formatDate(b.expiryDate, locale)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {onHand} {item.unit.code}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
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
      )}
    </div>
  );
}
