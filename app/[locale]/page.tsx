import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
      icon: ShieldCheck,
      title: t("featureMultiTenantTitle"),
      body: t("featureMultiTenantBody"),
    },
    {
      icon: ScanLine,
      title: t("featureBarcodeTitle"),
      body: t("featureBarcodeBody"),
    },
    {
      icon: BarChart3,
      title: t("featureReportsTitle"),
      body: t("featureReportsBody"),
    },
  ];

  const otherLocale = locale === "id" ? "en" : "id";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />

      <header className="relative">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span
              className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft"
              aria-hidden
            >
              <Boxes className="size-4" />
            </span>
            <span>{tApp("name")}</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href={`/${otherLocale}`}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {otherLocale.toUpperCase()}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {tAuth("signIn")}
            </Link>
            <Link href={`/${locale}/register`}>
              <Button size="sm" className="gap-1">
                {t("ctaPrimary")}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              {tApp("tagline")}
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              {t("headline")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              {t("subhead")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={`/${locale}/register`}>
                <Button size="lg" className="gap-2">
                  {t("ctaPrimary")}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
              <Link href={`/${locale}/login`}>
                <Button size="lg" variant="outline">
                  {tAuth("signIn")}
                </Button>
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-5xl">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="relative border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("ctaSecondary")}
            </h2>
            <p className="mt-2 text-muted-foreground">{tApp("tagline")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="size-5" aria-hidden />
                </div>
                <h3 className="text-base font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>
            &copy; {new Date().getFullYear()} {tApp("name")}
          </p>
          <p className="text-xs">{tApp("tagline")}</p>
        </div>
      </footer>
    </main>
  );
}

function DashboardPreview() {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-elevated sm:p-4">
      <div className="rounded-xl border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-destructive/70" aria-hidden />
          <span className="size-2.5 rounded-full bg-warning/70" aria-hidden />
          <span className="size-2.5 rounded-full bg-success/70" aria-hidden />
          <span className="ml-3 text-xs text-muted-foreground">
            warehousestok39.app/dashboard
          </span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {[
            { icon: Boxes, label: "Active items", value: "1,284", trend: "+8%" },
            { icon: Users, label: "Team members", value: "12", trend: "+2" },
            {
              icon: CheckCircle2,
              label: "Today movements",
              value: "47",
              trend: "+12",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="size-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">
                  {kpi.value}
                </span>
                <span className="text-xs font-medium text-success">
                  {kpi.trend}
                </span>
              </div>
              <Sparkline className="mt-4" />
            </div>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="grid grid-cols-[repeat(4,1fr)] gap-3 text-xs text-muted-foreground">
            <span>SKU</span>
            <span>Warehouse</span>
            <span>Qty</span>
            <span className="text-right">Status</span>
          </div>
          <div className="mt-2 space-y-2">
            {[
              ["INV-0091", "Jakarta", "240", "OK"],
              ["INV-0094", "Surabaya", "12", "Low"],
              ["INV-0102", "Bandung", "1,840", "OK"],
            ].map(([sku, wh, qty, status]) => (
              <div
                key={sku}
                className="grid grid-cols-[repeat(4,1fr)] items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{sku}</span>
                <span>{wh}</span>
                <span className="tabular-nums">{qty}</span>
                <span className="text-right">
                  <span
                    className={
                      status === "Low"
                        ? "inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium"
                        : "inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                    }
                  >
                    {status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 28"
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,20 L12,18 L24,22 L36,12 L48,16 L60,8 L72,12 L84,6 L100,10 L100,28 L0,28 Z"
        fill="url(#sparkGrad)"
      />
      <path
        d="M0,20 L12,18 L24,22 L36,12 L48,16 L60,8 L72,12 L84,6 L100,10"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
