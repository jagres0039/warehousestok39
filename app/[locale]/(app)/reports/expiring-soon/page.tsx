import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { getStockOnHandPerBatch } from "@/lib/inventory";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ALLOWED_WINDOWS = [30, 60, 90] as const;
type Window = (typeof ALLOWED_WINDOWS)[number];

function parseWindow(raw: string | undefined): Window {
  const n = raw ? Number.parseInt(raw, 10) : 30;
  if (ALLOWED_WINDOWS.includes(n as Window)) return n as Window;
  return 30;
}

function formatDate(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

export default async function ExpiringSoonPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("batches");
  const tCommon = await getTranslations("common");

  const win = parseWindow(sp.window);
  const now = new Date();
  const horizon = new Date(now.getTime() + win * 24 * 60 * 60 * 1000);

  const [batches, onHandRows] = await Promise.all([
    prisma.itemBatch.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        expiryDate: { not: null, lte: horizon },
      },
      orderBy: [{ expiryDate: "asc" }, { batchCode: "asc" }],
      select: {
        id: true,
        batchCode: true,
        expiryDate: true,
        item: {
          select: { id: true, sku: true, name: true, unit: { select: { code: true } } },
        },
      },
    }),
    getStockOnHandPerBatch(session.organizationId, {}),
  ]);

  const onHandByBatch = new Map<string, number>();
  for (const r of onHandRows) {
    if (!r.batchId) continue;
    onHandByBatch.set(r.batchId, (onHandByBatch.get(r.batchId) ?? 0) + r.qty);
  }

  const rows = batches
    .map((b) => ({
      ...b,
      onHand: onHandByBatch.get(b.id) ?? 0,
    }))
    .filter((b) => b.onHand > 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("expiringTitle")} description={t("expiringDescription")} />

      <form className="flex flex-wrap items-end gap-3" action="" method="GET">
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">{t("windowLabel")}</label>
          <select
            name="window"
            defaultValue={String(win)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="30">{t("window30")}</option>
            <option value="60">{t("window60")}</option>
            <option value="90">{t("window90")}</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {tCommon("apply")}
        </button>
      </form>

      <div className="rounded-md border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">{t("colItem")}</th>
              <th className="px-4 py-2">{t("colBatchCode")}</th>
              <th className="px-4 py-2">{t("colExpiryDate")}</th>
              <th className="px-4 py-2 text-right">{t("colDaysLeft")}</th>
              <th className="px-4 py-2 text-right">{t("colOnHand")}</th>
              <th className="px-4 py-2">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  {t("noExpiring")}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const expiry = r.expiryDate!;
                const diffMs = expiry.getTime() - now.getTime();
                const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
                const expired = daysLeft <= 0;
                return (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs text-muted-foreground">{r.item.sku}</div>
                      <Link
                        href={`/${locale}/items/${r.item.id}/batches`}
                        className="font-medium hover:underline"
                      >
                        {r.item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.batchCode}</td>
                    <td className="px-4 py-2">{formatDate(expiry, locale)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {expired ? `−${Math.abs(daysLeft)}` : daysLeft}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.onHand} {r.item.unit.code}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={expired ? "destructive" : "warning"}>
                        {expired ? t("statusExpired") : t("statusExpiringSoon")}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
