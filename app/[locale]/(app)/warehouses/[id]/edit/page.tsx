import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { WarehouseForm } from "../../WarehouseForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditWarehousePage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "edit warehouse");

  const warehouse = await prisma.warehouse.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      isDefault: true,
      isActive: true,
    },
  });
  if (!warehouse) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <WarehouseForm locale={locale} mode="edit" initial={warehouse} />
    </div>
  );
}
