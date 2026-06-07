import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { CreateOpnameForm } from "../CreateOpnameForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewStockOpnamePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create stock opname");
  const t = await getTranslations("opnames");
  const tMaster = await getTranslations("masterData");

  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, isDefault: true },
  });

  if (warehouses.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title={t("createTitle")} />
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>
            {t("noWarehousesYet")}{" "}
            <Link className="underline" href={`/${locale}/warehouses/new`}>
              {tMaster("warehouseCreateAction")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0]!;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("createTitle")} description={t("createDescription")} />
      <CreateOpnameForm
        locale={locale}
        warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        defaultWarehouseId={defaultWarehouse.id}
      />
    </div>
  );
}
