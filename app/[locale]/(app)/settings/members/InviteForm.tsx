"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inviteMemberAction, type InviteResult } from "./actions";

interface InviteFormProps {
  locale: string;
}

export function InviteForm({ locale }: InviteFormProps) {
  const t = useTranslations("members");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const [state, formAction] = useActionState<InviteResult | undefined, FormData>(
    inviteMemberAction,
    undefined,
  );

  function handleCopy() {
    if (state?.inviteUrl) {
      navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const errorKey = state?.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("inviteTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.ok && state.inviteUrl ? (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">{t("inviteSent")}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={state.inviteUrl}
                  className="flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="whitespace-nowrap rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  {copied ? t("copied") : t("copyLink")}
                </button>
              </div>
              <p className="text-xs text-emerald-600">{t("inviteLinkHint")}</p>
            </div>
          ) : null}

          {errorKey === "ALREADY_MEMBER" ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("errAlreadyMember")}
            </p>
          ) : null}
          {errorKey === "ALREADY_PENDING" ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("errAlreadyPending")}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[1fr,auto]">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="teammate@example.com"
              />
              {state?.fieldErrors?.email?.[0] ? (
                <p className="text-xs text-red-600">{state.fieldErrors.email[0]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">{t("roleLabel")}</Label>
              <select
                id="role"
                name="role"
                defaultValue="OPERATOR"
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ADMIN">{t("roleAdmin")}</option>
                <option value="OPERATOR">{t("roleOperator")}</option>
                <option value="VIEWER">{t("roleViewer")}</option>
              </select>
            </div>
          </div>

          <SubmitButton pendingLabel={tCommon("saving")}>
            {t("sendInvite")}
          </SubmitButton>
        </CardContent>
      </form>
    </Card>
  );
}
