import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { DocType } from "@prisma/client";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAdminister } from "@/lib/role-guard";
import { PageHeader } from "@/components/page-header";
import { DocNumberingForm } from "../DocNumberingForm";
import type { ResetPolicy } from "@/lib/doc-numbering";

export const dynamic = "force-dynamic";

const DOC_TYPES = [
  "GOODS_RECEIPT",
  "GOODS_ISSUE",
  "STOCK_ADJUSTMENT",
  "PURCHASE_ORDER",
  "SALES_ORDER",
  "INVOICE",
] as const satisfies readonly DocType[];

function isDocType(value: string): value is DocType {
  return (DOC_TYPES as readonly string[]).includes(value);
}

interface PageProps {
  params: Promise<{ locale: string; docType: string }>;
}

export default async function DocNumberingEditPage({ params }: PageProps) {
  const { locale, docType } = await params;
  setRequestLocale(locale);
  if (!isDocType(docType)) {
    notFound();
  }

  const session = await requireTenantSession(locale);
  const t = await getTranslations("settings");
  const tCommon = await getTranslations("common");

  const [org, cfg] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { slug: true },
    }),
    prisma.docNumberConfig.findUnique({
      where: {
        organizationId_docType: {
          organizationId: session.organizationId,
          docType,
        },
      },
    }),
  ]);

  if (!cfg) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/settings/document-numbering`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {tCommon("back")}
        </Link>
      </div>
      <PageHeader
        title={t("docNumberingEditTitle", { type: t(`docType_${docType}` as const) })}
        description={t("docNumberingEditDescription")}
      />
      <DocNumberingForm
        locale={locale}
        canEdit={canAdminister(session.role)}
        docType={docType}
        orgSlug={org.slug}
        currentCounter={cfg.currentCounter}
        initial={{
          template: cfg.template,
          resetPolicy: cfg.resetPolicy as ResetPolicy,
        }}
      />
    </div>
  );
}
