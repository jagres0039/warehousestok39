import { PartnerListPage } from "../_partners/PartnerListPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  return (
    <PartnerListPage
      locale={locale}
      searchParams={sp}
      kind="customer"
      basePath={`/${locale}/customers`}
      titleKey="customersTitle"
      descriptionKey="customersDescription"
      createKey="customerCreateAction"
      searchKey="customerSearchPlaceholder"
    />
  );
}
