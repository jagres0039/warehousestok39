import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "./LoginForm";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function LoginPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LoginForm locale={locale} />;
}
