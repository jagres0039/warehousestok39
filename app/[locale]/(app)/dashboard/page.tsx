import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("welcome", { name: session.name })}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("orgContext", { org: session.organizationName, role: session.role })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("metricItemsTitle")}</CardTitle>
            <CardDescription>{t("metricItemsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("metricLowStockTitle")}</CardTitle>
            <CardDescription>{t("metricLowStockDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("metricTodayMovementsTitle")}</CardTitle>
            <CardDescription>{t("metricTodayMovementsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">0</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("nextStepsTitle")}</CardTitle>
          <CardDescription>{t("nextStepsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{t("nextStep1")}</li>
            <li>{t("nextStep2")}</li>
            <li>{t("nextStep3")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
