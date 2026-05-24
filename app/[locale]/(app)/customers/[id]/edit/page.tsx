import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { PartnerForm } from "../../../_partners/PartnerForm";
import { updateCustomerAction } from "../../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditCustomerPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "edit customer");

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!customer) notFound();

  const t = await getTranslations("masterData");

  return (
    <div className="mx-auto max-w-2xl">
      <PartnerForm
        locale={locale}
        mode="edit"
        title={t("customerEditTitle")}
        formAction={updateCustomerAction.bind(null, customer.id)}
        initial={{
          id: customer.id,
          code: customer.code,
          name: customer.name,
          contactName: customer.contactName,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          isActive: customer.isActive,
        }}
      />
    </div>
  );
}
