import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockTransferForm } from "../../_transactions/forms";
import { createStockTransferAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewStockTransferPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create stock transfer");
  const t = await getTranslations("transfers");
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
      select: { id: true, sku: true, name: true, barcode: true, unit: { select: { code: true } } },
    }),
  ]);

  if (warehouses.length < 2 || items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title={t("createTitle")} />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {warehouses.length < 2 ? (
            <p>
              {t("needTwoWarehouses")}{" "}
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

  // We've already early-returned when warehouses.length < 2, so the [0] / [1]
  // accesses are guaranteed defined here.
  const defaultFrom = warehouses.find((w) => w.isDefault) ?? warehouses[0]!;
  const defaultTo =
    warehouses.find((w) => w.id !== defaultFrom.id) ?? warehouses[1]!;

  return (
    <div className="mx-auto max-w-4xl">
      <StockTransferForm
        locale={locale}
        warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        items={items.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          unitCode: i.unit.code,
          barcode: i.barcode,
        }))}
        defaultFromWarehouseId={defaultFrom.id}
        defaultToWarehouseId={defaultTo.id}
        action={createStockTransferAction}
      />
    </div>
  );
}
