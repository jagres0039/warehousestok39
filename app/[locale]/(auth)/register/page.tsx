import { setRequestLocale } from "next-intl/server";
import { RegisterForm } from "./RegisterForm";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function RegisterPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RegisterForm locale={locale} />;
}
