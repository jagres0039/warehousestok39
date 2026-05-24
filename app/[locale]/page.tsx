import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const features = [
    {
      title: t("featureMultiTenantTitle"),
      body: t("featureMultiTenantBody"),
    },
    {
      title: t("featureBarcodeTitle"),
      body: t("featureBarcodeBody"),
    },
    {
      title: t("featureReportsTitle"),
      body: t("featureReportsBody"),
    },
  ];

  const otherLocale = locale === "id" ? "en" : "id";

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <header className="container flex items-center justify-between py-6">
        <div className="text-xl font-semibold tracking-tight">{tApp("name")}</div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href={`/${locale}/login`} className="text-slate-700 hover:text-slate-900">
            {tAuth("signIn")}
          </Link>
          <Link href={`/${otherLocale}`} className="text-slate-500 hover:text-slate-900">
            {otherLocale.toUpperCase()}
          </Link>
        </nav>
      </header>

      <section className="container py-16 md:py-24">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-primary">
            {tApp("tagline")}
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {t("headline")}
          </h1>
          <p className="mt-4 text-lg text-slate-600">{t("subhead")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/register`}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="container border-t border-slate-200 py-6 text-sm text-slate-500">
        &copy; {new Date().getFullYear()} {tApp("name")}
      </footer>
    </main>
  );
}
