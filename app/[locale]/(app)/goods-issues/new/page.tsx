import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import { getStockOnHandPerBatch } from "@/lib/inventory";
import { PageHeader } from "@/components/page-header";
import { GoodsIssueForm } from "../../_transactions/forms";
import { createGoodsIssueAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewGoodsIssuePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create goods issue");
  const t = await getTranslations("transactions");
  const tMaster = await getTranslations("masterData");

  const [warehouses, customers, items] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, isDefault: true },
    }),
    prisma.customer.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.item.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        barcode: true,
        tracksBatch: true,
        unit: { select: { code: true } },
        batches: {
          where: { isActive: true },
          orderBy: [{ expiryDate: "asc" }, { batchCode: "asc" }],
          select: { id: true, batchCode: true, expiryDate: true },
        },
      },
    }),
  ]);

  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  // Per-batch on-hand at the default source warehouse (used for FEFO labels).
  // Page is force-dynamic so we re-render on warehouse change via reload.
  const onHandRows = defaultWarehouse
    ? await getStockOnHandPerBatch(session.organizationId, {
        warehouseId: defaultWarehouse.id,
      })
    : [];
  const onHandByBatch = new Map<string, number>();
  for (const row of onHandRows) {
    if (row.batchId) onHandByBatch.set(row.batchId, row.qty);
  }

  // (defaultWarehouse already computed above)
  if (warehouses.length === 0 || items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title={t("issueCreateTitle")} />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {warehouses.length === 0 ? (
            <p>
              {t("noWarehousesYet")}{" "}
              <Link className="underline" href={`/${locale}/warehouses/new`}>
                {tMaster("warehouseCreateAction")}
              </Link>
            </p>
          ) : (
            <p>
              {tMaster("noUnitsYet")}{" "}
              <Link className="underline" href={`/${locale}/items/new`}>
                {tMaster("itemCreateAction")}
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <GoodsIssueForm
        locale={locale}
        warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        customers={customers}
        items={items.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          unitCode: i.unit.code,
          barcode: i.barcode,
          tracksBatch: i.tracksBatch,
          batches: i.batches
            .map((b) => ({
              id: b.id,
              batchCode: b.batchCode,
              expiryDate: b.expiryDate ? b.expiryDate.toISOString() : null,
              onHand: onHandByBatch.get(b.id) ?? 0,
            }))
            .filter((b) => b.onHand > 0),
        }))}
        defaultWarehouseId={defaultWarehouse?.id}
        action={createGoodsIssueAction}
      />
    </div>
  );
}
