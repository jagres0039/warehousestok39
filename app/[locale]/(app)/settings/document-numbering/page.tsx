import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { DocType } from "@prisma/client";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { previewDocumentNumber } from "@/lib/doc-numbering";
import type { ResetPolicy } from "@/lib/doc-numbering";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const DOC_TYPE_ORDER: ReadonlyArray<DocType> = [
  "GOODS_RECEIPT",
  "GOODS_ISSUE",
  "STOCK_ADJUSTMENT",
  "PURCHASE_ORDER",
  "SALES_ORDER",
  "INVOICE",
];

export default async function DocNumberingListPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("settings");
  const tCommon = await getTranslations("common");

  const [org, configs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { slug: true },
    }),
    prisma.docNumberConfig.findMany({
      where: { organizationId: session.organizationId },
      select: {
        docType: true,
        template: true,
        resetPolicy: true,
        currentCounter: true,
      },
    }),
  ]);

  const byType = new Map<DocType, (typeof configs)[number]>();
  for (const c of configs) byType.set(c.docType, c);

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
        title={t("docNumberingTitle")}
        description={t("docNumberingDescription")}
      />

      <div className="rounded-md border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("docTypeColumn")}</th>
              <th className="px-4 py-3">{t("templateColumn")}</th>
              <th className="px-4 py-3">{t("previewColumn")}</th>
              <th className="px-4 py-3">{t("resetPolicyColumn")}</th>
              <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {DOC_TYPE_ORDER.map((dt) => {
              const cfg = byType.get(dt);
              const sample = cfg
                ? previewDocumentNumber(
                    cfg.template,
                    org.slug.toUpperCase(),
                    cfg.currentCounter + 1 || 1,
                  )
                : "—";
              return (
                <tr key={dt} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    {t(`docType_${dt}` as const)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {cfg?.template ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{sample}</td>
                  <td className="px-4 py-3 text-foreground">
                    {cfg
                      ? t(`resetPolicy_${cfg.resetPolicy as ResetPolicy}` as const)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${locale}/settings/document-numbering/${dt}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {tCommon("edit")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
