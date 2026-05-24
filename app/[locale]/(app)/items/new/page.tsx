import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import { ItemForm } from "../ItemForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewItemPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create item");

  const t = await getTranslations("masterData");

  const [categories, units] = await Promise.all([
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

  if (units.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {t("noUnitsYet")}
        </p>
        <Link href={`/${locale}/units/new`} className="text-sm font-medium text-primary hover:underline">
          {t("unitCreateAction")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ItemForm locale={locale} mode="create" categories={categories} units={units} />
    </div>
  );
}
