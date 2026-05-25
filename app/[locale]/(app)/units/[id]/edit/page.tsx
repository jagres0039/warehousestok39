import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { UnitForm } from "../../UnitForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditUnitPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "edit unit");

  const unit = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!unit) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl">
      <UnitForm locale={locale} mode="edit" initial={unit} />
    </div>
  );
}
