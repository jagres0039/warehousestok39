import { PartnerListPage } from "../_partners/PartnerListPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function SuppliersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  return (
    <PartnerListPage
      locale={locale}
      searchParams={sp}
      kind="supplier"
      basePath={`/${locale}/suppliers`}
      titleKey="suppliersTitle"
      descriptionKey="suppliersDescription"
      createKey="supplierCreateAction"
      searchKey="supplierSearchPlaceholder"
    />
  );
}
