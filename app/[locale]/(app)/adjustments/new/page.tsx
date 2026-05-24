import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockAdjustmentForm } from "../../_transactions/forms";
import { createStockAdjustmentAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewStockAdjustmentPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create stock adjustment");
  const t = await getTranslations("transactions");
  const tMaster = await getTranslations("masterData");

  const [warehouses, items] = await Promise.all([
    prisma.warehouse.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, isDefault: true },
    }),
    prisma.item.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, unit: { select: { code: true } } },
    }),
  ]);

  if (warehouses.length === 0 || items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title={t("adjustmentCreateTitle")} />
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

  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];

  return (
    <div className="mx-auto max-w-4xl">
      <StockAdjustmentForm
        locale={locale}
        warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        items={items.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          unitCode: i.unit.code,
        }))}
        defaultWarehouseId={defaultWarehouse?.id}
        action={createStockAdjustmentAction}
      />
    </div>
  );
}
