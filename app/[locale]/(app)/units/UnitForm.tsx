"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { createUnitAction, updateUnitAction } from "./actions";
import type { ActionResult } from "@/lib/master-data-schemas";

interface UnitFormProps {
  locale: string;
  mode: "create" | "edit";
  initial?: { id: string; code: string; name: string; isActive: boolean };
}

export function UnitForm({ locale, mode, initial }: UnitFormProps) {
  const t = useTranslations("masterData");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && initial
      ? updateUnitAction.bind(null, initial.id)
      : createUnitAction;
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "create" ? t("unitCreateTitle") : t("unitEditTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.error === "CODE_TAKEN" && (
            <p className="text-sm text-red-600">{t("codeTaken")}</p>
          )}
          {state?.error === "NOT_FOUND" && (
            <p className="text-sm text-red-600">{tCommon("notFound")}</p>
          )}
          <FormField
            id="code"
            label={t("code")}
            defaultValue={initial?.code}
            hint={t("unitCodeHint")}
            error={state?.fieldErrors?.code?.[0]}
            required
          />
          <FormField
            id="name"
            label={t("name")}
            defaultValue={initial?.name}
            error={state?.fieldErrors?.name?.[0]}
            required
          />
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

interface FormFieldProps {
  id: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
  error?: string;
  required?: boolean;
  type?: string;
}

export function FormField({ id, label, defaultValue, hint, error, required, type = "text" }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
      />
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface CheckboxFieldProps {
  id: string;
  label: string;
  defaultChecked?: boolean;
}

export function CheckboxField({ id, label, defaultChecked }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        id={id}
        name={id}
        defaultChecked={defaultChecked ?? true}
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
      />
      <span>{label}</span>
    </label>
  );
}
