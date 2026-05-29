"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { acceptInvitationAction, type AcceptResult } from "./actions";

interface AcceptFormProps {
  locale: string;
  token: string;
  email: string;
  role: string;
  organizationName: string;
  inviterName: string;
  expiresAt: string;
  userExists: boolean;
}

export function AcceptForm({
  locale,
  token,
  email,
  role,
  organizationName,
  inviterName,
  expiresAt,
  userExists,
}: AcceptFormProps) {
  const t = useTranslations("invitation");
  const tAuth = useTranslations("auth");

  // The user may insist on switching modes (e.g. they have no account yet but
  // we wrongly inferred they did). Default to whatever the backend told us.
  const [mode, setMode] = useState<"existing" | "new">(userExists ? "existing" : "new");

  const [state, formAction] = useActionState<AcceptResult | undefined, FormData>(
    acceptInvitationAction,
    undefined,
  );

  const fieldErr = (n: string) => state?.fieldErrors?.[n]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("subtitle", { org: organizationName, inviter: inviterName })}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="mode" value={mode} />
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("email")}</div>
                <div className="font-medium">{email}</div>
              </div>
              <Badge variant="success">{t(`role${role.charAt(0) + role.slice(1).toLowerCase()}`)}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("expiresAt")}: {expiresAt}
            </p>
          </div>

          {state?.error === "INVALID_CREDENTIALS" ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t("errInvalidCredentials")}
            </p>
          ) : null}
          {state?.error === "EMAIL_TAKEN_BY_OTHER" ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t("errEmailTakenByOther")}
            </p>
          ) : null}
          {(state?.error === "EXPIRED" ||
            state?.error === "REVOKED" ||
            state?.error === "NOT_FOUND" ||
            state?.error === "ALREADY_ACCEPTED") ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(`err${state.error.charAt(0) + state.error.slice(1).toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`)}
            </p>
          ) : null}

          {/* Mode toggle */}
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={
                mode === "existing"
                  ? "rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground"
                  : "rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted/40"
              }
            >
              {t("haveAccount")}
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={
                mode === "new"
                  ? "rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground"
                  : "rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted/40"
              }
            >
              {t("noAccount")}
            </button>
          </div>

          {mode === "new" ? (
            <div className="space-y-1.5">
              <Label htmlFor="name">{tAuth("name")}</Label>
              <Input id="name" name="name" type="text" autoComplete="name" required />
              {fieldErr("name") ? (
                <p className="text-xs text-red-600">{fieldErr("name")}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="password">{tAuth("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "new" ? "new-password" : "current-password"}
              required
              minLength={8}
            />
            {fieldErr("password") ? (
              <p className="text-xs text-red-600">{fieldErr("password")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{tAuth("passwordHint")}</p>
            )}
          </div>

          <SubmitButton className="w-full" pendingLabel={t("accepting")}>
            {t("acceptButton")}
          </SubmitButton>

          <p className="text-center text-xs text-muted-foreground">
            <Link href={`/${locale}/login`} className="hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </CardContent>
      </form>
    </Card>
  );
}
