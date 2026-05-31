import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/role-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CancelTransactionDialog } from "../../_transactions/CancelTransactionDialog";
import { cancelGoodsReceiptAction } from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function GoodsReceiptDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("transactions");
  const tCommon = await getTranslations("common");

  const receipt = await prisma.goodsReceipt.findFirst({
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
  if (!receipt) notFound();

  const supplier = receipt.supplierId
    ? await prisma.supplier.findFirst({
        where: { id: receipt.supplierId, organizationId: session.organizationId },
        select: { code: true, name: true },
      })
    : null;

  const cancelAction = cancelGoodsReceiptAction.bind(null, receipt.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/${locale}/goods-receipts`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {t("receiptsTitle")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("receiptDetailTitle")} <span className="font-mono">{receipt.docNo}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/print/goods-receipt/${receipt.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/40"
          >
            {tCommon("printPdf")}
          </a>
          <Badge variant={receipt.status === "POSTED" ? "success" : "muted"}>
            {receipt.status === "POSTED" ? t("statusPosted") : t("statusCanceled")}
          </Badge>
          {receipt.status === "POSTED" && canMutate(session.role) ? (
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
            {receipt.occurredAt.toISOString().replace("T", " ").slice(0, 16)}
          </Field>
          <Field label={t("warehouse")}>
            {receipt.warehouse.code} — {receipt.warehouse.name}
          </Field>
          <Field label={t("supplier")}>
            {supplier ? `${supplier.code} — ${supplier.name}` : "—"}
          </Field>
          <Field label={t("noteLabel")}>{receipt.note ?? "—"}</Field>
          {receipt.status === "CANCELED" ? (
            <>
              <Field label={t("canceledAt")}>
                {receipt.canceledAt?.toISOString().replace("T", " ").slice(0, 16) ?? "—"}
              </Field>
              <Field label={t("cancelReason")}>{receipt.cancelReason ?? "—"}</Field>
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
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t("item")}</th>
                <th className="px-4 py-2 text-right">{t("qty")}</th>
                <th className="px-4 py-2">{t("lineNote")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {receipt.lines.map((l) => (
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
        {tCommon("createdAt")}: {receipt.createdAt.toISOString().replace("T", " ").slice(0, 16)}
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
