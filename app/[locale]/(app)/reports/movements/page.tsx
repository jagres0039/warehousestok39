import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMovementReport } from "@/lib/reports";
import { parseDateRange } from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
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
  TRANSFER_IN: "success",
  TRANSFER_OUT: "warning",
  TRANSFER_REVERSAL: "muted",
  OPNAME_IN: "success",
  OPNAME_OUT: "warning",
  OPNAME_REVERSAL: "muted",
};

export default async function MovementsReportPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("reports");
  const tCommon = await getTranslations("common");
  const tTx = await getTranslations("transactions");

  const range = parseDateRange(sp);
  const warehouseId = sp.warehouseId || undefined;
  const refType = sp.refType as
    | "GoodsReceipt"
    | "GoodsIssue"
    | "StockAdjustment"
    | "StockTransfer"
    | "StockOpname"
    | undefined;

  const [warehouses, rows] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    getMovementReport(session.organizationId, {
      from: range.from,
      to: range.to,
      warehouseId,
      refType,
    }),
  ]);

  const qs = new URLSearchParams();
  if (range.fromInput) qs.set("from", range.fromInput);
  if (range.toInput) qs.set("to", range.toInput);
  if (warehouseId) qs.set("warehouseId", warehouseId);
  if (refType) qs.set("refType", refType);
  const exportHref = `/api/exports/movements.xlsx?${qs.toString()}`;

  const totalIn = rows.reduce((a, r) => a + (r.qtyDelta > 0 ? r.qtyDelta : 0), 0);
  const totalOut = rows.reduce((a, r) => a + (r.qtyDelta < 0 ? -r.qtyDelta : 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("movementsTitle")}
        description={t("movementsDescription")}
      />

      <form className="flex flex-wrap items-end gap-3" action="" method="GET">
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">{t("from")}</label>
          <input
            type="date"
            name="from"
            defaultValue={range.fromInput}
            className="h-9 rounded-md border border-border px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">{t("to")}</label>
          <input
            type="date"
            name="to"
            defaultValue={range.toInput}
            className="h-9 rounded-md border border-border px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">{tTx("warehouse")}</label>
          <select
            name="warehouseId"
            defaultValue={warehouseId ?? ""}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="">{t("allWarehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">{t("docType")}</label>
          <select
            name="refType"
            defaultValue={refType ?? ""}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="">{t("allDocTypes")}</option>
            <option value="GoodsReceipt">{tTx("receiptsTitle")}</option>
            <option value="GoodsIssue">{tTx("issuesTitle")}</option>
            <option value="StockAdjustment">{tTx("adjustmentsTitle")}</option>
            <option value="StockTransfer">{tTx("transfersTitle")}</option>
            <option value="StockOpname">{tTx("opnamesTitle")}</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {tCommon("apply")}
        </button>
        <a
          href={exportHref}
          className="h-9 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/40"
        >
          {t("exportExcel")}
        </a>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label={t("totalIn")} value={totalIn} locale={locale} tone="in" />
        <SummaryCard label={t("totalOut")} value={totalOut} locale={locale} tone="out" />
        <SummaryCard
          label={t("entriesCount")}
          value={rows.length}
          locale={locale}
          tone="neutral"
        />
      </div>

      <div className="rounded-md border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{tTx("occurredAt")}</th>
                <th className="px-4 py-2">{tTx("warehouse")}</th>
                <th className="px-4 py-2">{tTx("item")}</th>
                <th className="px-4 py-2">{t("type")}</th>
                <th className="px-4 py-2">{tTx("docNo")}</th>
                <th className="px-4 py-2 text-right">{t("in")}</th>
                <th className="px-4 py-2 text-right">{t("out")}</th>
                <th className="px-4 py-2">{tTx("noteLabel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {t("noMovements")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isIn = r.qtyDelta > 0;
                  return (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2 text-muted-foreground">
                        {r.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.warehouseCode}</td>
                      <td className="px-4 py-2">
                        <div className="font-mono text-xs text-muted-foreground">{r.itemSku}</div>
                        <div>{r.itemName}</div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={moveTypeVariant[r.moveType] ?? "neutral"}>
                          {t(`moveType.${r.moveType}` as const)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {r.refDocNo ? (
                          <Link
                            href={refLink(locale, r.refType, r.refId)}
                            className="text-primary hover:underline"
                          >
                            {r.refDocNo}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {isIn ? `${r.qtyDelta.toLocaleString(locale)} ${r.unitCode}` : ""}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {!isIn ? `${Math.abs(r.qtyDelta).toLocaleString(locale)} ${r.unitCode}` : ""}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.note ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length === 5000 ? (
        <p className="text-xs text-amber-700">{t("truncatedNote")}</p>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  locale,
  tone,
}: {
  label: string;
  value: number;
  locale: string;
  tone: "in" | "out" | "neutral";
}) {
  const color =
    tone === "in" ? "text-emerald-700" : tone === "out" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${color}`}>
        {value.toLocaleString(locale)}
      </p>
    </div>
  );
}

function refLink(locale: string, refType: string, refId: string): string {
  if (refType === "GoodsReceipt") return `/${locale}/goods-receipts/${refId}`;
  if (refType === "GoodsIssue") return `/${locale}/goods-issues/${refId}`;
  if (refType === "StockAdjustment") return `/${locale}/adjustments/${refId}`;
  if (refType === "StockTransfer") return `/${locale}/transfers/${refId}`;
  if (refType === "StockOpname") return `/${locale}/opnames/${refId}`;
  return "#";
}
