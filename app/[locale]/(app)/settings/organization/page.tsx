import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAdminister } from "@/lib/role-guard";
import { PageHeader } from "@/components/page-header";
import { OrganizationForm } from "./OrganizationForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function OrganizationSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("settings");
  const tCommon = await getTranslations("common");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: {
      slug: true,
      name: true,
      address: true,
      npwp: true,
      logoUrl: true,
      currency: true,
      timezone: true,
      defaultLocale: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/settings`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {tCommon("back")}
        </Link>
      </div>
      <PageHeader
        title={t("organizationTitle")}
        description={t("organizationDescription")}
      />
      <OrganizationForm
        locale={locale}
        canEdit={canAdminister(session.role)}
        initial={org}
      />
    </div>
  );
}
