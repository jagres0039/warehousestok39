import { setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { UnitForm } from "../UnitForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewUnitPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create unit");

  return (
    <div className="mx-auto max-w-xl">
      <UnitForm locale={locale} mode="create" />
    </div>
  );
}
