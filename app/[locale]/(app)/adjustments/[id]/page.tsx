import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/role-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CancelTransactionDialog } from "../../_transactions/CancelTransactionDialog";
import { cancelStockAdjustmentAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function StockAdjustmentDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("transactions");
  const tCommon = await getTranslations("common");

  const adjustment = await prisma.stockAdjustment.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      warehouse: { select: { code: true, name: true } },
      lines: {
        include: {
          item: { select: { sku: true, name: true, unit: { select: { code: true } } } },
        },
      },
    },
  });
  if (!adjustment) notFound();

  const cancelAction = cancelStockAdjustmentAction.bind(null, adjustment.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/${locale}/adjustments`}
            className="text-xs text-slate-500 hover:underline"
          >
            ← {t("adjustmentsTitle")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("adjustmentDetailTitle")} <span className="font-mono">{adjustment.docNo}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={adjustment.status === "POSTED" ? "success" : "muted"}>
            {adjustment.status === "POSTED" ? t("statusPosted") : t("statusCanceled")}
          </Badge>
          {adjustment.status === "POSTED" && canMutate(session.role) ? (
            <CancelTransactionDialog
              triggerLabel={t("cancelAction")}
              title={t("cancelDialogTitle")}
              locale={locale}
              action={cancelAction}
            />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("headerInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label={t("occurredAt")}>
            {adjustment.occurredAt.toISOString().replace("T", " ").slice(0, 16)}
          </Field>
          <Field label={t("warehouse")}>
            {adjustment.warehouse.code} — {adjustment.warehouse.name}
          </Field>
          <Field label={t("reasonLabel")}>{adjustment.reason ?? "—"}</Field>
          {adjustment.status === "CANCELED" ? (
            <>
              <Field label={t("canceledAt")}>
                {adjustment.canceledAt?.toISOString().replace("T", " ").slice(0, 16) ?? "—"}
              </Field>
              <Field label={t("cancelReason")}>{adjustment.cancelReason ?? "—"}</Field>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("linesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">{t("item")}</th>
                <th className="px-4 py-2">{t("direction")}</th>
                <th className="px-4 py-2 text-right">{t("qty")}</th>
                <th className="px-4 py-2">{t("lineNote")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustment.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    <div className="font-mono text-xs text-slate-500">{l.item.sku}</div>
                    <div>{l.item.name}</div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={l.direction === "IN" ? "success" : "warning"}>
                      {l.direction === "IN" ? t("directionIn") : t("directionOut")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {Number(l.qty).toLocaleString(locale)} {l.item.unit.code}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{l.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        {tCommon("createdAt")}: {adjustment.createdAt.toISOString().replace("T", " ").slice(0, 16)}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
