import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ReportsIndexPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireTenantSession(locale);
  const t = await getTranslations("reports");

  const cards: Array<{ href: string; titleKey: "movementsTitle" | "lowStockTitle" | "stockCardTitle"; descKey: "movementsDescription" | "lowStockDescription" | "stockCardIndexDescription" }> = [
    {
      href: `/${locale}/reports/movements`,
      titleKey: "movementsTitle",
      descKey: "movementsDescription",
    },
    {
      href: `/${locale}/reports/low-stock`,
      titleKey: "lowStockTitle",
      descKey: "lowStockDescription",
    },
    {
      href: `/${locale}/items`,
      titleKey: "stockCardTitle",
      descKey: "stockCardIndexDescription",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("indexTitle")} description={t("indexDescription")} />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="transition group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base group-hover:text-primary">
                  {t(c.titleKey)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{t(c.descKey)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
