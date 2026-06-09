import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ListChecks,
  Sparkles,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, roleBadgeVariant } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface DailyBucket {
  day: string;
  inCount: number;
  outCount: number;
}

const SPARK_DAYS = 14;

export default async function DashboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("dashboard");

  const now = new Date();
  const startWindow = new Date(now);
  startWindow.setHours(0, 0, 0, 0);
  startWindow.setDate(startWindow.getDate() - (SPARK_DAYS - 1));

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [
    activeItems,
    activeCategories,
    activeSuppliers,
    activeCustomers,
    activeWarehouses,
    teamSize,
    todayMovements,
    windowEntries,
  ] = await Promise.all([
    prisma.item.count({
      where: { organizationId: session.organizationId, isActive: true },
    }),
    prisma.category.count({
      where: { organizationId: session.organizationId, isActive: true },
    }),
    prisma.supplier.count({
      where: { organizationId: session.organizationId, isActive: true },
    }),
    prisma.customer.count({
      where: { organizationId: session.organizationId, isActive: true },
    }),
    prisma.warehouse.count({
      where: { organizationId: session.organizationId, isActive: true },
    }),
    prisma.membership.count({
      where: { organizationId: session.organizationId },
    }),
    prisma.stockLedger.count({
      where: {
        organizationId: session.organizationId,
        occurredAt: { gte: todayStart },
      },
    }),
    prisma.stockLedger.findMany({
      where: {
        organizationId: session.organizationId,
        occurredAt: { gte: startWindow },
      },
      select: { occurredAt: true, qtyDelta: true },
    }),
  ]);

  const buckets = buildBuckets(windowEntries, startWindow, SPARK_DAYS);
  const totalIn = buckets.reduce((acc, b) => acc + b.inCount, 0);
  const totalOut = buckets.reduce((acc, b) => acc + b.outCount, 0);
  const yesterdayBucket = buckets[buckets.length - 2];
  const todayBucket = buckets[buckets.length - 1];
  const todayDelta =
    (todayBucket?.inCount ?? 0) +
    (todayBucket?.outCount ?? 0) -
    ((yesterdayBucket?.inCount ?? 0) + (yesterdayBucket?.outCount ?? 0));

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/30 p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              {t("orgContext", {
                org: session.organizationName,
                role: session.role,
              })}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("welcome", { name: session.name })}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("nextStepsDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={roleBadgeVariant(session.role)}>{session.role}</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          icon={Boxes}
          label={t("metricItemsTitle")}
          description={t("metricItemsDescription")}
          value={activeItems.toLocaleString()}
          tone="primary"
          sparkline={
            <Sparkline
              points={buckets.map((b) => b.inCount + b.outCount)}
              tone="primary"
            />
          }
          delta={null}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("metricTodayMovementsTitle")}
          description={t("metricTodayMovementsDescription")}
          value={todayMovements.toLocaleString()}
          tone="success"
          sparkline={
            <Sparkline
              points={buckets.map((b) => b.inCount + b.outCount)}
              tone="success"
            />
          }
          delta={todayDelta}
        />
        <KpiCard
          icon={ListChecks}
          label={t("metricLowStockTitle")}
          description={t("metricLowStockDescription")}
          value="0"
          tone="warning"
          sparkline={null}
          delta={null}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          icon={Boxes}
          label={t("masterDataCategories")}
          value={activeCategories}
        />
        <SummaryTile
          icon={Users}
          label={t("masterDataSuppliers")}
          value={activeSuppliers}
        />
        <SummaryTile
          icon={Users}
          label={t("masterDataCustomers")}
          value={activeCustomers}
        />
        <SummaryTile
          icon={Warehouse}
          label={t("masterDataWarehouses")}
          value={activeWarehouses}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("movementSummaryTitle")}</CardTitle>
            <CardDescription>
              {t("movementSummaryDescription", { days: SPARK_DAYS })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowDownToLine className="size-3.5 text-success" aria-hidden />
                  {t("inboundLabel")}
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {totalIn.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowUpFromLine className="size-3.5 text-destructive" aria-hidden />
                  {t("outboundLabel")}
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {totalOut.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-success" aria-hidden />
                {t("inboundLabel")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-destructive" aria-hidden />
                {t("outboundLabel")}
              </span>
            </div>
            <MovementBarChart buckets={buckets} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("nextStepsTitle")}</CardTitle>
            <CardDescription>{t("nextStepsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[t("nextStep1"), t("nextStep2"), t("nextStep3")].map((step, i) => (
              <Link
                key={i}
                href={`/${locale}/items`}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted"
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                  {i + 1}
                </span>
                <span className="text-foreground">{step}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        {t("teamSizeFooter", { count: teamSize })}
      </p>
    </div>
  );
}

function buildBuckets(
  entries: { occurredAt: Date; qtyDelta: { toNumber: () => number } }[],
  startWindow: Date,
  days: number,
): DailyBucket[] {
  const buckets: DailyBucket[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startWindow);
    d.setDate(startWindow.getDate() + i);
    buckets.push({
      day: d.toISOString().slice(0, 10),
      inCount: 0,
      outCount: 0,
    });
  }
  for (const e of entries) {
    const key = e.occurredAt.toISOString().slice(0, 10);
    const bucket = buckets.find((b) => b.day === key);
    if (!bucket) continue;
    const qty = Number(e.qtyDelta);
    if (qty >= 0) bucket.inCount += 1;
    else bucket.outCount += 1;
  }
  return buckets;
}

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  value: string;
  tone: "primary" | "success" | "warning";
  sparkline: React.ReactNode;
  delta: number | null;
}

function KpiCard({
  icon: Icon,
  label,
  description,
  value,
  tone,
  sparkline,
  delta,
}: KpiCardProps) {
  const toneClass = {
    primary: "bg-accent text-accent-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone];

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-elevated">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            {description}
          </CardDescription>
        </div>
        <span
          className={cn(
            "grid size-9 place-items-center rounded-md",
            toneClass,
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
          {delta !== null ? (
            <span
              className={cn(
                "text-xs font-medium",
                delta > 0
                  ? "text-success"
                  : delta < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          ) : null}
        </div>
        {sparkline ? <div className="h-10 w-full">{sparkline}</div> : null}
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Sparkline({
  points,
  tone,
}: {
  points: number[];
  tone: "primary" | "success" | "warning";
}) {
  const stroke =
    tone === "success"
      ? "hsl(var(--success))"
      : tone === "warning"
      ? "hsl(var(--warning))"
      : "hsl(var(--primary))";
  const max = Math.max(1, ...points);
  const step = points.length > 1 ? 100 / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = 30 - (p / max) * 26 - 2;
    return `${x},${y}`;
  });
  const linePath = coords.length ? `M${coords.join(" L")}` : "";
  const areaPath = coords.length
    ? `${linePath} L100,30 L0,30 Z`
    : "";

  return (
    <svg
      viewBox="0 0 100 30"
      className="h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill={`url(#spark-${tone})`} /> : null}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function MovementBarChart({
  buckets,
  className,
}: {
  buckets: DailyBucket[];
  className?: string;
}) {
  const width = 100;
  const height = 48;
  const max = Math.max(
    1,
    ...buckets.map((b) => Math.max(b.inCount, b.outCount)),
  );
  const groupWidth = buckets.length > 0 ? width / buckets.length : width;
  const barWidth = groupWidth * 0.3;
  const gap = groupWidth * 0.1;
  const lead = (groupWidth - (barWidth * 2 + gap)) / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-28 w-full", className)}
      aria-hidden
    >
      <line
        x1="0"
        y1={height}
        x2={width}
        y2={height}
        stroke="hsl(var(--border))"
        strokeWidth="0.5"
      />
      {buckets.map((b, i) => {
        const groupStart = i * groupWidth + lead;
        const inHeight = (b.inCount / max) * (height - 2);
        const outHeight = (b.outCount / max) * (height - 2);
        return (
          <g key={b.day}>
            <rect
              x={groupStart}
              y={height - inHeight}
              width={barWidth}
              height={inHeight}
              fill="hsl(var(--success))"
            />
            <rect
              x={groupStart + barWidth + gap}
              y={height - outHeight}
              width={barWidth}
              height={outHeight}
              fill="hsl(var(--destructive))"
            />
          </g>
        );
      })}
    </svg>
  );
}
