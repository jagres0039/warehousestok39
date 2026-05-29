import Link from "next/link";
import { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { Boxes } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[640px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center">
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
              <span>Warehousestok39</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
