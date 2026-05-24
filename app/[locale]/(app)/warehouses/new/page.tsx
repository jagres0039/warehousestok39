import { setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { WarehouseForm } from "../WarehouseForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewWarehousePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create warehouse");

  return (
    <div className="mx-auto max-w-2xl">
      <WarehouseForm locale={locale} mode="create" />
    </div>
  );
}
