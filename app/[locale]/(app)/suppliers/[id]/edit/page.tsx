import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { PartnerForm } from "../../../_partners/PartnerForm";
import { updateSupplierAction } from "../../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditSupplierPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "edit supplier");

  const supplier = await prisma.supplier.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!supplier) notFound();

  const t = await getTranslations("masterData");

  return (
    <div className="mx-auto max-w-2xl">
      <PartnerForm
        locale={locale}
        mode="edit"
        title={t("supplierEditTitle")}
        formAction={updateSupplierAction.bind(null, supplier.id)}
        initial={{
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          contactName: supplier.contactName,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          isActive: supplier.isActive,
        }}
      />
    </div>
  );
}
