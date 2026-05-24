"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCategoryAction, updateCategoryAction } from "./actions";
import { CheckboxField } from "../units/UnitForm";
import type { ActionResult } from "@/lib/master-data-schemas";

interface CategoryFormProps {
  locale: string;
  mode: "create" | "edit";
  initial?: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  };
}

export function CategoryForm({ locale, mode, initial }: CategoryFormProps) {
  const t = useTranslations("masterData");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && initial
      ? updateCategoryAction.bind(null, initial.id)
      : createCategoryAction;
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? t("categoryCreateTitle") : t("categoryEditTitle")}
        </CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.error === "NAME_TAKEN" && (
            <p className="text-sm text-red-600">{t("nameTaken")}</p>
          )}
          {state?.error === "NOT_FOUND" && (
            <p className="text-sm text-red-600">{tCommon("notFound")}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
            {state?.fieldErrors?.name?.[0] && (
              <p className="text-xs text-red-600">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} />
          </div>

          <CheckboxField id="isActive" label={t("isActive")} defaultChecked={initial?.isActive ?? true} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{tCommon("save")}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
