import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/role-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CancelTransactionDialog } from "../../_transactions/CancelTransactionDialog";
import { cancelStockTransferAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function StockTransferDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("transfers");
  const tTx = await getTranslations("transactions");
  const tCommon = await getTranslations("common");

  const transfer = await prisma.stockTransfer.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      fromWarehouse: { select: { code: true, name: true } },
      toWarehouse: { select: { code: true, name: true } },
      lines: {
        include: {
          item: { select: { sku: true, name: true, unit: { select: { code: true } } } },
        },
      },
    },
  });
  if (!transfer) notFound();

  const cancelAction = cancelStockTransferAction.bind(null, transfer.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/${locale}/transfers`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {t("listTitle")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("detailTitle")} <span className="font-mono">{transfer.docNo}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={transfer.status === "POSTED" ? "success" : "muted"}>
            {transfer.status === "POSTED" ? tTx("statusPosted") : tTx("statusCanceled")}
          </Badge>
          {transfer.status === "POSTED" && canMutate(session.role) ? (
            <CancelTransactionDialog
              triggerLabel={tTx("cancelAction")}
              title={tTx("cancelDialogTitle")}
              locale={locale}
              action={cancelAction}
            />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tTx("headerInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label={tTx("occurredAt")}>
            {transfer.occurredAt.toISOString().replace("T", " ").slice(0, 16)}
          </Field>
          <Field label={t("from")}>
            {transfer.fromWarehouse.code} — {transfer.fromWarehouse.name}
          </Field>
          <Field label={t("to")}>
            <span className="inline-flex items-center gap-1.5">
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              {transfer.toWarehouse.code} — {transfer.toWarehouse.name}
            </span>
          </Field>
          <Field label={tTx("noteLabel")}>{transfer.note ?? "—"}</Field>
          {transfer.status === "CANCELED" ? (
            <>
              <Field label={tTx("canceledAt")}>
                {transfer.canceledAt?.toISOString().replace("T", " ").slice(0, 16) ?? "—"}
              </Field>
              <Field label={tTx("cancelReason")}>{transfer.cancelReason ?? "—"}</Field>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tTx("linesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{tTx("item")}</th>
                <th className="px-4 py-2 text-right">{tTx("qty")}</th>
                <th className="px-4 py-2">{tTx("lineNote")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfer.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    <div className="font-mono text-xs text-muted-foreground">{l.item.sku}</div>
                    <div>{l.item.name}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {Number(l.qty).toLocaleString(locale)} {l.item.unit.code}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{l.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {tCommon("createdAt")}: {transfer.createdAt.toISOString().replace("T", " ").slice(0, 16)}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
