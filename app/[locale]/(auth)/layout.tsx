import Link from "next/link";
import { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link href={`/${locale}`} className="inline-block text-2xl font-semibold tracking-tight">
              Warehousestok39
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
