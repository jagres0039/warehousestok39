import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { CategoryForm } from "../../CategoryForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditCategoryPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "edit category");

  const category = await prisma.category.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, name: true, description: true, isActive: true },
  });
  if (!category) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl">
      <CategoryForm locale={locale} mode="edit" initial={category} />
    </div>
  );
}
