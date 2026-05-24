import { setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { CategoryForm } from "../CategoryForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewCategoryPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create category");

  return (
    <div className="mx-auto max-w-xl">
      <CategoryForm locale={locale} mode="create" />
    </div>
  );
}
