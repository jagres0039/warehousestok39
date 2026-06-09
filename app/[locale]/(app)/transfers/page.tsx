import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parsePagination, buildPageResult } from "@/lib/pagination";
import { canMutate } from "@/lib/role-guard";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function StockTransfersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("transfers");
  const tCommon = await getTranslations("common");
  const tTx = await getTranslations("transactions");

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
    prisma.stockTransfer.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        fromWarehouse: { select: { id: true, code: true } },
        toWarehouse: { select: { id: true, code: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.stockTransfer.count({ where }),
  ]);

  const result = buildPageResult(rows, total, pagination);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("listTitle")}
        description={t("listDescription")}
        action={
          canMutate(session.role)
            ? { label: t("createAction"), href: `/${locale}/transfers/new` }
            : undefined
        }
      />

      <SearchInput placeholder={t("searchPlaceholder")} />

      {result.rows.length === 0 ? (
        q ? (
          <EmptyState icon={ArrowLeftRight} title={tCommon("noResults")} />
        ) : (
          <EmptyState
            icon={ArrowLeftRight}
            title={t("listTitle")}
            description={t("listDescription")}
            action={
              canMutate(session.role)
                ? { label: t("createAction"), href: `/${locale}/transfers/new` }
                : undefined
            }
          />
        )
      ) : (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{tTx("docNo")}</th>
                <th className="px-4 py-3">{tTx("occurredAt")}</th>
                <th className="px-4 py-3">{t("from")}</th>
                <th className="px-4 py-3 w-6"></th>
                <th className="px-4 py-3">{t("to")}</th>
                <th className="px-4 py-3 text-right">{tTx("lineCount")}</th>
                <th className="px-4 py-3">{tTx("status")}</th>
                <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {result.rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs">{r.docNo}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.fromWarehouse.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <ArrowRight className="size-4" aria-hidden />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.toWarehouse.code}</td>
                  <td className="px-4 py-3 text-right font-mono">{r._count.lines}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "POSTED" ? "success" : "muted"}>
                      {r.status === "POSTED" ? tTx("statusPosted") : tTx("statusCanceled")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${locale}/transfers/${r.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {tCommon("view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.totalPages > 1 ? (
            <Pagination
              basePath={`/${locale}/transfers`}
              searchParams={sp}
              page={result.page}
              totalPages={result.totalPages}
              labels=
                previous: tCommon("previous"),
                next: tCommon("next"),
                pageOf: tCommon("pageOf"),
              
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
