import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

const SUPPORTED_LOCALES = ["id", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = requested && isSupported(requested) ? requested : "id";

  let messages;
  try {
    messages = (await import(`./messages/${locale}.json`)).default;
  } catch {
    notFound();
  }

  return { locale, messages };
});
