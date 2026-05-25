import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getLowStockReport } from "@/lib/reports";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LowStockReportPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("reports");
  const tCommon = await getTranslations("common");
  const tTx = await getTranslations("transactions");

  const warehouseId = sp.warehouseId || undefined;
  const [warehouses, rows] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    getLowStockReport(session.organizationId, { warehouseId }),
  ]);

  const qs = new URLSearchParams();
  if (warehouseId) qs.set("warehouseId", warehouseId);
  const exportHref = `/api/exports/low-stock.xlsx?${qs.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("lowStockTitle")} description={t("lowStockDescription")} />

      <form className="flex flex-wrap items-end gap-3" action="" method="GET">
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
        <a
          href={exportHref}
          className="h-9 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        >
          {t("exportExcel")}
        </a>
      </form>

      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2">{tTx("item")}</th>
              <th className="px-4 py-2 text-right">{t("minStock")}</th>
              <th className="px-4 py-2 text-right">{t("onHand")}</th>
              <th className="px-4 py-2 text-right">{t("shortBy")}</th>
              <th className="px-4 py-2 text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  {t("noLowStock")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.itemId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div className="font-mono text-xs text-slate-500">{r.sku}</div>
                    <div>{r.name}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-500">
                    {r.minStock.toLocaleString(locale)} {r.unitCode}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {r.onHand.toLocaleString(locale)} {r.unitCode}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">
                    -{r.shortBy.toLocaleString(locale)} {r.unitCode}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/${locale}/items/${r.itemId}/card`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t("openStockCard")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
