"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/master-data-schemas";
import { updateOrganizationAction } from "./actions";

interface OrganizationFormProps {
  locale: string;
  canEdit: boolean;
  initial: {
    slug: string;
    name: string;
    address: string | null;
    npwp: string | null;
    logoUrl: string | null;
    currency: string;
    timezone: string;
    defaultLocale: string;
  };
}

export function OrganizationForm({ locale, canEdit, initial }: OrganizationFormProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    updateOrganizationAction,
    undefined,
  );

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("organizationFormTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.ok ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {t("savedNotice")}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t("slug")}</Label>
            <Input value={initial.slug} disabled readOnly />
            <p className="text-xs text-muted-foreground">{t("slugLockedHint")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("orgName")}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={initial.name}
                disabled={!canEdit}
                required
              />
              {fieldError("name") ? (
                <p className="text-xs text-red-600">{fieldError("name")}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="npwp">{t("npwp")}</Label>
              <Input
                id="npwp"
                name="npwp"
                defaultValue={initial.npwp ?? ""}
                disabled={!canEdit}
              />
              {fieldError("npwp") ? (
                <p className="text-xs text-red-600">{fieldError("npwp")}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">{t("address")}</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={initial.address ?? ""}
              disabled={!canEdit}
              rows={3}
            />
            {fieldError("address") ? (
              <p className="text-xs text-red-600">{fieldError("address")}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="logoUrl">{t("logoUrl")}</Label>
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={initial.logoUrl ?? ""}
              disabled={!canEdit}
              placeholder="https://..."
            />
            {fieldError("logoUrl") ? (
              <p className="text-xs text-red-600">{fieldError("logoUrl")}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">{t("currency")}</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue={initial.currency}
                disabled={!canEdit}
                required
                maxLength={8}
                placeholder="IDR"
              />
              {fieldError("currency") ? (
                <p className="text-xs text-red-600">{fieldError("currency")}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">{t("timezone")}</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue={initial.timezone}
                disabled={!canEdit}
                required
                placeholder="Asia/Jakarta"
              />
              {fieldError("timezone") ? (
                <p className="text-xs text-red-600">{fieldError("timezone")}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultLocale">{t("defaultLocale")}</Label>
              <select
                id="defaultLocale"
                name="defaultLocale"
                defaultValue={initial.defaultLocale}
                disabled={!canEdit}
                className="h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="id">{t("localeId")}</option>
                <option value="en">{t("localeEn")}</option>
              </select>
            </div>
          </div>
        </CardContent>
        {canEdit ? (
          <CardFooter className="justify-end gap-2">
            <SubmitButton pendingLabel={tCommon("saving")}>{tCommon("save")}</SubmitButton>
          </CardFooter>
        ) : null}
      </form>
    </Card>
  );
}
