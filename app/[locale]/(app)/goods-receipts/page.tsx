import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parsePagination, buildPageResult } from "@/lib/pagination";
import { canMutate } from "@/lib/role-guard";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function GoodsReceiptsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("transactions");
  const tCommon = await getTranslations("common");

  const pagination = parsePagination({ page: sp.page, pageSize: sp.pageSize });
  const q = (sp.q ?? "").trim();
  const where = {
    organizationId: session.organizationId,
    ...(q
      ? {
          OR: [
            { docNo: { contains: q, mode: "insensitive" as const } },
            { note: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        warehouse: { select: { id: true, code: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.goodsReceipt.count({ where }),
  ]);
  const supplierIds = rows
    .map((r) => r.supplierId)
    .filter((v): v is string => Boolean(v));
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds }, organizationId: session.organizationId },
        select: { id: true, name: true },
      })
    : [];
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const result = buildPageResult(rows, total, pagination);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("receiptsTitle")}
        description={t("receiptsDescription")}
        action={
          canMutate(session.role)
            ? { label: t("receiptCreateAction"), href: `/${locale}/goods-receipts/new` }
            : undefined
        }
      />

      <SearchInput placeholder={t("receiptSearchPlaceholder")} />

      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">{t("docNo")}</th>
              <th className="px-4 py-3">{t("occurredAt")}</th>
              <th className="px-4 py-3">{t("warehouse")}</th>
              <th className="px-4 py-3">{t("supplier")}</th>
              <th className="px-4 py-3 text-right">{t("lineCount")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  {tCommon("noResults")}
                </td>
              </tr>
            ) : (
              result.rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.docNo}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.warehouse.code}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.supplierId ? supplierName.get(r.supplierId) ?? "-" : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r._count.lines}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "POSTED" ? "success" : "muted"}>
                      {r.status === "POSTED" ? t("statusPosted") : t("statusCanceled")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${locale}/goods-receipts/${r.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {tCommon("view")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {result.totalPages > 1 ? (
          <Pagination
            basePath={`/${locale}/goods-receipts`}
            searchParams={sp}
            page={result.page}
            totalPages={result.totalPages}
            labels={{
              previous: tCommon("previous"),
              next: tCommon("next"),
              pageOf: tCommon("pageOf"),
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
