import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PackageOpen } from "lucide-react";
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

export default async function ItemsListPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const session = await requireTenantSession(locale);
  const t = await getTranslations("masterData");
  const tCommon = await getTranslations("common");

  const pagination = parsePagination({ page: sp.page, pageSize: sp.pageSize });
  const q = (sp.q ?? "").trim();

  const where = {
    organizationId: session.organizationId,
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        category: { select: { name: true } },
        unit: { select: { code: true } },
      },
    }),
    prisma.item.count({ where }),
  ]);
  const result = buildPageResult(rows, total, pagination);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("itemsTitle")}
        description={t("itemsDescription")}
        action={
          canMutate(session.role)
            ? { label: t("itemCreateAction"), href: `/${locale}/items/new` }
            : undefined
        }
      />

      <SearchInput placeholder={t("itemSearchPlaceholder")} />

      {result.rows.length === 0 ? (
        q ? (
          <EmptyState icon={PackageOpen} title={tCommon("noResults")} />
        ) : (
          <EmptyState
            icon={PackageOpen}
            title={t("itemsTitle")}
            description={t("itemsDescription")}
            action={
              canMutate(session.role)
                ? { label: t("itemCreateAction"), href: `/${locale}/items/new` }
                : undefined
            }
          />
        )
      ) : (
        <div className="rounded-md border border-border bg-card shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("sku")}</th>
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">{t("category")}</th>
                <th className="px-4 py-3">{t("unit")}</th>
                <th className="px-4 py-3 text-right">{t("minStock")}</th>
                <th className="px-4 py-3">{t("status")}</th>
                <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {result.rows.map((i) => (
                <tr key={i.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs uppercase">{i.sku}</td>
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.category?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.unit.code}</td>
                  <td className="px-4 py-3 text-right">{i.minStock.toString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={i.isActive ? "success" : "muted"}>
                      {i.isActive ? tCommon("active") : tCommon("inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/${locale}/items/${i.id}/card`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {tCommon("stockCard")}
                      </Link>
                      {i.tracksBatch ? (
                        <Link
                          href={`/${locale}/items/${i.id}/batches`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {tCommon("viewBatches")}
                        </Link>
                      ) : null}
                      <a
                        href={`/api/print/item-label/${i.id}?locale=${locale}`}
                        target="_blank"
                        rel="noopener"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {tCommon("qrLabel")}
                      </a>
                      {canMutate(session.role) ? (
                        <Link
                          href={`/${locale}/items/${i.id}/edit`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {tCommon("edit")}
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.totalPages > 1 ? (
            <Pagination
              basePath={`/${locale}/items`}
              searchParams={sp}
              page={result.page}
              totalPages={result.totalPages}
              labels={
                {
                  previous: tCommon("previous"),
                  next: tCommon("next"),
                  pageOf: tCommon("pageOf"),
                }
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
