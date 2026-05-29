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

export default async function UnitsListPage({ params, searchParams }: PageProps) {
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
            { code: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.unit.count({ where }),
  ]);
  const result = buildPageResult(rows, total, pagination);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("unitsTitle")}
        description={t("unitsDescription")}
        action={
          canMutate(session.role)
            ? { label: t("unitCreateAction"), href: `/${locale}/units/new` }
            : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder={t("unitSearchPlaceholder")} />
      </div>

      <div className="rounded-md border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("code")}</th>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            ) : (
              result.rows.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs uppercase">{u.code}</td>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? "success" : "muted"}>
                      {u.isActive ? tCommon("active") : tCommon("inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canMutate(session.role) ? (
                      <Link
                        href={`/${locale}/units/${u.id}/edit`}
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
            basePath={`/${locale}/units`}
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
