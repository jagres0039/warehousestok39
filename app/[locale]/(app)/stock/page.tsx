import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStockOnHand } from "@/lib/inventory";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function StockPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("stock");
  const tCommon = await getTranslations("common");

  const [warehouses, allItems, onHand] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.item.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { sku: "asc" },
      include: { unit: { select: { code: true } } },
    }),
    getStockOnHand(session.organizationId, {
      warehouseId: sp.warehouseId,
    }),
  ]);

  // Build a lookup: warehouseId -> itemId -> qty
  const map = new Map<string, Map<string, number>>();
  for (const w of warehouses) map.set(w.id, new Map());
  for (const row of onHand) {
    const wmap = map.get(row.warehouseId) ?? map.set(row.warehouseId, new Map()).get(row.warehouseId)!;
    wmap.set(row.itemId, Number(row.qty));
  }

  const selectedWarehouseId = sp.warehouseId ?? "";
  const visibleWarehouses = selectedWarehouseId
    ? warehouses.filter((w) => w.id === selectedWarehouseId)
    : warehouses;

  // Filter rows: only show items with at least one nonzero qty in visible warehouses,
  // OR with minStock > 0 so users can spot under-stock.
  const itemsWithStock = allItems.filter((item) => {
    const qtys = visibleWarehouses.map((w) => map.get(w.id)?.get(item.id) ?? 0);
    return qtys.some((q) => q !== 0) || Number(item.minStock) > 0;
  });

  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = q
    ? itemsWithStock.filter(
        (it) =>
          it.sku.toLowerCase().includes(q) ||
          it.name.toLowerCase().includes(q) ||
          (it.barcode ?? "").toLowerCase().includes(q),
      )
    : itemsWithStock;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <form className="flex flex-wrap items-center gap-3" action={`/${locale}/stock`} method="GET">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="h-9 w-64 rounded-md border border-border px-3 text-sm"
        />
        <select
          name="warehouseId"
          defaultValue={selectedWarehouseId}
          className="h-9 rounded-md border border-border bg-white px-3 text-sm"
        >
          <option value="">{t("allWarehouses")}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {tCommon("search")}
        </button>
      </form>

      <div className="rounded-md border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-white px-4 py-3">{t("item")}</th>
                <th className="px-4 py-3 text-right">{t("minStock")}</th>
                {visibleWarehouses.map((w) => (
                  <th key={w.id} className="px-4 py-3 text-right">
                    {w.code}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">{t("total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleWarehouses.length + 3}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {tCommon("noResults")}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const min = Number(item.minStock);
                  const totals = visibleWarehouses.map(
                    (w) => map.get(w.id)?.get(item.id) ?? 0,
                  );
                  const total = totals.reduce((a, b) => a + b, 0);
                  const lowStock = total < min;
                  return (
                    <tr key={item.id} className="hover:bg-muted/40">
                      <td className="sticky left-0 bg-white px-4 py-3">
                        <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                        <Link
                          href={`/${locale}/items/${item.id}/edit`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {item.name}
                        </Link>{" "}
                        <span className="text-xs text-muted-foreground">({item.unit.code})</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {min.toLocaleString(locale)}
                      </td>
                      {visibleWarehouses.map((w, idx) => (
                        <td key={w.id} className="px-4 py-3 text-right font-mono">
                          {(totals[idx] ?? 0).toLocaleString(locale)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={lowStock ? "text-red-600 font-semibold" : ""}>
                          {total.toLocaleString(locale)}
                        </span>
                        {lowStock ? (
                          <Badge variant="warning" className="ml-2">
                            {t("lowStock")}
                          </Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
