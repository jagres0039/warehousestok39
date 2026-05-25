import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { ItemForm } from "../../ItemForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditItemPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "edit item");

  const [item, categories, units] = await Promise.all([
    prisma.item.findFirst({
      where: { id, organizationId: session.organizationId },
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.unit.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);
  if (!item) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ItemForm
        locale={locale}
        mode="edit"
        initial={{
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          barcode: item.barcode,
          categoryId: item.categoryId,
          unitId: item.unitId,
          minStock: item.minStock.toString(),
          imageUrl: item.imageUrl,
          isActive: item.isActive,
        }}
        categories={categories}
        units={units}
      />
    </div>
  );
}
