import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  labels: {
    previous: string;
    next: string;
    pageOf: string; // e.g. "Halaman {page} dari {total}"
  };
}

function buildHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined && v !== "" && k !== "page") {
      params.set(k, v);
    }
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({ basePath, searchParams, page, totalPages, labels }: PaginationProps) {
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {labels.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}
      </p>
      <div className="flex items-center gap-2">
        <PaginationLink
          href={buildHref(basePath, searchParams, prevPage)}
          disabled={prevDisabled}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {labels.previous}
        </PaginationLink>
        <PaginationLink
          href={buildHref(basePath, searchParams, nextPage)}
          disabled={nextDisabled}
        >
          {labels.next}
          <ChevronRight className="size-4" aria-hidden />
        </PaginationLink>
      </div>
    </div>
  );
}

interface LinkProps {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function PaginationLink({ href, disabled, children }: LinkProps) {
  const className = cn(
    "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    disabled
      ? "pointer-events-none cursor-not-allowed text-muted-foreground/50"
      : "text-foreground shadow-sm hover:bg-muted",
  );
  if (disabled) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
