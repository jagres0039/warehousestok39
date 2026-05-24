import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { PartnerForm } from "../../_partners/PartnerForm";
import { createCustomerAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewCustomerPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create customer");
  const t = await getTranslations("masterData");

  return (
    <div className="mx-auto max-w-2xl">
      <PartnerForm
        locale={locale}
        mode="create"
        title={t("customerCreateTitle")}
        formAction={createCustomerAction}
      />
    </div>
  );
}
