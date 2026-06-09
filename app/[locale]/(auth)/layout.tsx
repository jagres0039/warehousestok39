import Link from "next/link";
import { ReactNode } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { BarChart3, Boxes, ScanLine, ShieldCheck } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");

  const highlights = [
    { icon: ShieldCheck, label: t("featureMultiTenantTitle") },
    { icon: ScanLine, label: t("featureBarcodeTitle") },
    { icon: BarChart3, label: t("featureReportsTitle") },
  ];

  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-border bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl"
        />
        <Link
          href={`/${locale}`}
          className="relative flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span
            className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft"
            aria-hidden
          >
            <Boxes className="size-4" />
          </span>
          <span>{tApp("name")}</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-balance text-3xl font-semibold tracking-tight">
            {t("headline")}
          </h2>
          <p className="mt-3 text-balance text-muted-foreground">
            {t("subhead")}
          </p>
          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li key={h.label} className="flex items-center gap-3 text-sm">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground ring-1 ring-inset ring-primary/10"
                  aria-hidden
                >
                  <h.icon className="size-4" />
                </span>
                <span className="font-medium">{h.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} {tApp("name")}
        </p>
      </aside>

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-40 lg:hidden"
        />
        <div className="relative w-full max-w-md">
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <span
                className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft"
                aria-hidden
              >
                <Boxes className="size-5" />
              </span>
              <span>{tApp("name")}</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
