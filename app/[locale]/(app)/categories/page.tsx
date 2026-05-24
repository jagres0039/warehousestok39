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

export default async function CategoriesListPage({ params, searchParams }: PageProps) {
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
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: { _count: { select: { items: true } } },
    }),
    prisma.category.count({ where }),
  ]);
  const result = buildPageResult(rows, total, pagination);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("categoriesTitle")}
        description={t("categoriesDescription")}
        action={
          canMutate(session.role)
            ? { label: t("categoryCreateAction"), href: `/${locale}/categories/new` }
            : undefined
        }
      />

      <SearchInput placeholder={t("categorySearchPlaceholder")} />

      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("description")}</th>
              <th className="px-4 py-3">{t("itemCount")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  {tCommon("noResults")}
                </td>
              </tr>
            ) : (
              result.rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.description ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{c._count.items}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? "success" : "muted"}>
                      {c.isActive ? tCommon("active") : tCommon("inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canMutate(session.role) ? (
                      <Link
                        href={`/${locale}/categories/${c.id}/edit`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {tCommon("edit")}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {result.totalPages > 1 ? (
          <Pagination
            basePath={`/${locale}/categories`}
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
