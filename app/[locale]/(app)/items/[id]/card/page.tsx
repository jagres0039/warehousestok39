import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStockCard } from "@/lib/reports";
import { parseDateRange } from "@/lib/date-range";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const moveTypeVariant: Record<string, "success" | "warning" | "muted" | "neutral"> = {
  RECEIPT: "success",
  ISSUE: "warning",
  ADJUSTMENT_IN: "success",
  ADJUSTMENT_OUT: "warning",
  RECEIPT_REVERSAL: "muted",
  ISSUE_REVERSAL: "muted",
  ADJUSTMENT_REVERSAL: "muted",
};

export default async function ItemStockCardPage({ params, searchParams }: PageProps) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("reports");
  const tCommon = await getTranslations("common");
  const tTx = await getTranslations("transactions");

  const range = parseDateRange(sp);
  const warehouseId = sp.warehouseId || undefined;

  const [warehouses, card] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    getStockCard(session.organizationId, id, {
      from: range.from,
      to: range.to,
      warehouseId,
    }),
  ]);
  if (!card) notFound();

  const queryString = new URLSearchParams();
  if (range.fromInput) queryString.set("from", range.fromInput);
  if (range.toInput) queryString.set("to", range.toInput);
  if (warehouseId) queryString.set("warehouseId", warehouseId);
  const exportHref = `/api/exports/stock-card/${id}.xlsx?${queryString.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/${locale}/items`}
            className="text-xs text-slate-500 hover:underline"
          >
            ← {tCommon("back")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("stockCardTitle")}: <span className="font-mono">{card.item.sku}</span>
          </h1>
          <p className="text-sm text-slate-600">
            {card.item.name} ({card.item.unitCode})
          </p>
        </div>
        <a
          href={exportHref}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        >
          {t("exportExcel")}
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3" action="" method="GET">
        <div className="space-y-1">
          <label className="block text-xs text-slate-600">{t("from")}</label>
          <input
            type="date"
            name="from"
            defaultValue={range.fromInput}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-slate-600">{t("to")}</label>
          <input
            type="date"
            name="to"
            defaultValue={range.toInput}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-slate-600">{tTx("warehouse")}</label>
          <select
            name="warehouseId"
            defaultValue={warehouseId ?? ""}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">{t("allWarehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          {tCommon("apply")}
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("openingBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">
              {card.openingBalance.toLocaleString(locale)}{" "}
              <span className="text-sm font-normal text-slate-500">{card.item.unitCode}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("entriesCount")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">
              {card.entries.length.toLocaleString(locale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("closingBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold">
              {card.closingBalance.toLocaleString(locale)}{" "}
              <span className="text-sm font-normal text-slate-500">{card.item.unitCode}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2">{tTx("occurredAt")}</th>
              <th className="px-4 py-2">{tTx("warehouse")}</th>
              <th className="px-4 py-2">{t("type")}</th>
              <th className="px-4 py-2">{tTx("docNo")}</th>
              <th className="px-4 py-2 text-right">{t("in")}</th>
              <th className="px-4 py-2 text-right">{t("out")}</th>
              <th className="px-4 py-2 text-right">{t("balance")}</th>
              <th className="px-4 py-2">{tTx("noteLabel")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {card.entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  {t("noMovements")}
                </td>
              </tr>
            ) : (
              card.entries.map((e) => {
                const isIn = e.qtyDelta > 0;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">
                      {e.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{e.warehouseCode}</td>
                    <td className="px-4 py-2">
                      <Badge variant={moveTypeVariant[e.moveType] ?? "neutral"}>
                        {t(`moveType.${e.moveType}` as const)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {e.refDocNo ? (
                        <Link
                          href={refLink(locale, e.refType, e.refId)}
                          className="text-primary hover:underline"
                        >
                          {e.refDocNo}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {isIn ? e.qtyDelta.toLocaleString(locale) : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {!isIn ? Math.abs(e.qtyDelta).toLocaleString(locale) : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-medium">
                      {e.balanceAfter.toLocaleString(locale)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{e.note ?? "—"}</td>
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

function refLink(locale: string, refType: string, refId: string): string {
  if (refType === "GoodsReceipt") return `/${locale}/goods-receipts/${refId}`;
  if (refType === "GoodsIssue") return `/${locale}/goods-issues/${refId}`;
  if (refType === "StockAdjustment") return `/${locale}/adjustments/${refId}`;
  return "#";
}
