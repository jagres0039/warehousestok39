"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { CheckboxField } from "../units/UnitForm";
import type { ActionResult } from "@/lib/master-data-schemas";

export interface PartnerInitial {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

interface PartnerFormProps {
  locale: string;
  mode: "create" | "edit";
  initial?: PartnerInitial;
  title: string;
  formAction: (
    state: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function PartnerForm({ locale, initial, title, formAction }: PartnerFormProps) {
  const t = useTranslations("masterData");
  const tCommon = useTranslations("common");

  const [state, action] = useActionState<ActionResult | undefined, FormData>(
    formAction,
    undefined,
  );

  const err = (n: string) => state?.fieldErrors?.[n]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <form action={action}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.error === "CODE_TAKEN" && (
            <p className="text-sm text-red-600">{t("codeTaken")}</p>
          )}
          {state?.error === "NOT_FOUND" && (
            <p className="text-sm text-red-600">{tCommon("notFound")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code">{t("code")}</Label>
              <Input id="code" name="code" defaultValue={initial?.code ?? ""} required />
              {err("code") && <p className="text-xs text-red-600">{err("code")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
              {err("name") && <p className="text-xs text-red-600">{err("name")}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contactName">{t("contactName")}</Label>
              <Input id="contactName" name="contactName" defaultValue={initial?.contactName ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" name="phone" defaultValue={initial?.phone ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} />
            {err("email") && <p className="text-xs text-red-600">{err("email")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">{t("address")}</Label>
            <Textarea id="address" name="address" defaultValue={initial?.address ?? ""} />
          </div>

          <CheckboxField
            id="isActive"
            label={t("isActive")}
            defaultChecked={initial?.isActive ?? true}
          />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{tCommon("save")}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
