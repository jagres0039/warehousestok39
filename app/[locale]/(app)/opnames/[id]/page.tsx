import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canMutate } from "@/lib/role-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OpnameCountClient } from "./OpnameCountClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function StockOpnameDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("opnames");
  const tTx = await getTranslations("transactions");
  const tCommon = await getTranslations("common");

  const opname = await prisma.stockOpname.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      warehouse: { select: { code: true, name: true } },
      lines: {
        orderBy: { item: { sku: "asc" } },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              barcode: true,
              unit: { select: { code: true } },
            },
          },
        },
      },
    },
  });
  if (!opname) notFound();

  const isDraft = opname.status === "DRAFT";

  const rows = opname.lines.map((l) => ({
    itemId: l.itemId,
    sku: l.item.sku,
    name: l.item.name,
    unitCode: l.item.unit.code,
    barcode: l.item.barcode,
    systemQty: String(l.systemQty),
    countedQty: String(l.countedQty),
    varianceQty: String(l.varianceQty),
    note: l.note,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/${locale}/opnames`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {t("listTitle")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("detailTitle")} <span className="font-mono">{opname.docNo}</span>
          </h1>
        </div>
        <Badge
          variant={
            opname.status === "POSTED"
              ? "success"
              : opname.status === "DRAFT"
                ? "info"
                : "muted"
          }
        >
          {opname.status === "DRAFT"
            ? t("statusDraft")
            : opname.status === "POSTED"
              ? t("statusPosted")
              : t("statusCanceled")}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tTx("headerInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label={tTx("occurredAt")}>
            {opname.occurredAt.toISOString().replace("T", " ").slice(0, 16)}
          </Field>
          <Field label={t("warehouse")}>
            {opname.warehouse.code} — {opname.warehouse.name}
          </Field>
          <Field label={tTx("noteLabel")}>{opname.note ?? "—"}</Field>
          {opname.postedAt ? (
            <Field label={t("postedAt")}>
              {opname.postedAt.toISOString().replace("T", " ").slice(0, 16)}
            </Field>
          ) : null}
          {opname.status === "CANCELED" ? (
            <>
              <Field label={tTx("canceledAt")}>
                {opname.canceledAt?.toISOString().replace("T", " ").slice(0, 16) ?? "—"}
              </Field>
              <Field label={tTx("cancelReason")}>{opname.cancelReason ?? "—"}</Field>
            </>
          ) : null}
        </CardContent>
      </Card>

      <OpnameCountClient
        locale={locale}
        opnameId={opname.id}
        isDraft={isDraft}
        canMutate={canMutate(session.role)}
        rows={rows}
      />

      <p className="text-xs text-muted-foreground">
        {tCommon("createdAt")}: {opname.createdAt.toISOString().replace("T", " ").slice(0, 16)}
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
