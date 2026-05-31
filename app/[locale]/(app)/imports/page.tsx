import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanAdminister } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ImportClient } from "./ImportClient";
import {
  importItemsAction,
  importSuppliersAction,
  importCustomersAction,
  importCategoriesAction,
  importWarehousesAction,
} from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ImportsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  // Bulk import is an administrative action — only OWNER/ADMIN can do it.
  // We assert here AND inside each server action (defence in depth).
  assertCanAdminister(session.role, "open bulk import");

  const t = await getTranslations("imports");

  const [units, categories] = await Promise.all([
    prisma.unit.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ImportClient
        locale={locale}
        unitCodes={units.map((u) => u.code)}
        categoryNames={categories.map((c) => c.name)}
        actions={{
          items: importItemsAction,
          suppliers: importSuppliersAction,
          customers: importCustomersAction,
          categories: importCategoriesAction,
          warehouses: importWarehousesAction,
        }}
      />
    </div>
  );
}
