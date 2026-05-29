import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { listPartners } from "@/lib/partner-service";
import { parsePagination, buildPageResult } from "@/lib/pagination";
import { canMutate } from "@/lib/role-guard";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

interface PartnerListProps {
  locale: string;
  searchParams: Record<string, string | undefined>;
  kind: "supplier" | "customer";
  basePath: string;
  titleKey: string;
  descriptionKey: string;
  createKey: string;
  searchKey: string;
}

export async function PartnerListPage({
  locale,
  searchParams,
  kind,
  basePath,
  titleKey,
  descriptionKey,
  createKey,
  searchKey,
}: PartnerListProps) {
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("masterData");
  const tCommon = await getTranslations("common");

  const pagination = parsePagination({ page: searchParams.page, pageSize: searchParams.pageSize });
  const q = (searchParams.q ?? "").trim();

  const { rows, total } = await listPartners(
    kind,
    session.organizationId,
    q,
    pagination.skip,
    pagination.take,
  );
  const result = buildPageResult(rows, total, pagination);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(titleKey)}
        description={t(descriptionKey)}
        action={
          canMutate(session.role)
            ? { label: t(createKey), href: `${basePath}/new` }
            : undefined
        }
      />

      <SearchInput placeholder={t(searchKey)} />

      <div className="rounded-md border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("code")}</th>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("contactName")}</th>
              <th className="px-4 py-3">{t("phone")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            ) : (
              result.rows.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs uppercase">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.contactName ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isActive ? "success" : "muted"}>
                      {p.isActive ? tCommon("active") : tCommon("inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canMutate(session.role) ? (
                      <Link
                        href={`${basePath}/${p.id}/edit`}
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
            basePath={basePath}
            searchParams={searchParams}
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
