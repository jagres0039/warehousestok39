import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { previewInvitation, InvitationError } from "@/lib/invitations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptForm } from "./AcceptForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function InvitationPage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invitation");

  let preview;
  let errorCode: string | null = null;
  try {
    preview = await previewInvitation(token);
  } catch (err) {
    if (err instanceof InvitationError) {
      errorCode = err.code;
    } else {
      throw err;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link
              href={`/${locale}`}
              className="inline-block text-2xl font-semibold tracking-tight"
            >
              Warehousestok39
            </Link>
          </div>

          {!preview ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("invalidTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {errorCode === "EXPIRED"
                    ? t("errExpired")
                    : errorCode === "REVOKED"
                    ? t("errRevoked")
                    : errorCode === "ALREADY_ACCEPTED"
                    ? t("errAlreadyAccepted")
                    : t("errNotFound")}
                </p>
                <p>
                  <Link href={`/${locale}/login`} className="text-primary hover:underline">
                    {t("backToLogin")} &rarr;
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <AcceptForm
              locale={locale}
              token={token}
              email={preview.email}
              role={preview.role}
              organizationName={preview.organizationName}
              inviterName={preview.inviterName}
              expiresAt={preview.expiresAt.toLocaleDateString(locale === "id" ? "id-ID" : "en-US")}
              userExists={preview.userExists}
            />
          )}
        </div>
      </div>
    </div>
  );
}
