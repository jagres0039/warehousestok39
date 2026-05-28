import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { canAdminister } from "@/lib/role-guard";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function SettingsLandingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("settings");

  const adminOnly = !canAdminister(session.role);

  const sections = [
    {
      key: "organization",
      href: `/${locale}/settings/organization`,
    },
    {
      key: "members",
      href: `/${locale}/settings/members`,
    },
    {
      key: "docNumbering",
      href: `/${locale}/settings/document-numbering`,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {adminOnly ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("adminOnlyNotice")}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.key}>
            <CardHeader>
              <CardTitle>{t(`${s.key}Title`)}</CardTitle>
              <CardDescription>{t(`${s.key}Description`)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={s.href}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("open")} →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
