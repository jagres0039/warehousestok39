"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { CheckboxField } from "../units/UnitForm";
import { createWarehouseAction, updateWarehouseAction } from "./actions";
import type { ActionResult } from "@/lib/master-data-schemas";

interface WarehouseFormProps {
  locale: string;
  mode: "create" | "edit";
  initial?: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    isDefault: boolean;
    isActive: boolean;
  };
}

export function WarehouseForm({ locale, mode, initial }: WarehouseFormProps) {
  const t = useTranslations("masterData");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && initial
      ? updateWarehouseAction.bind(null, initial.id)
      : createWarehouseAction;
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const err = (n: string) => state?.fieldErrors?.[n]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? t("warehouseCreateTitle") : t("warehouseEditTitle")}
        </CardTitle>
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

          <div className="space-y-1.5">
            <Label htmlFor="address">{t("address")}</Label>
            <Textarea id="address" name="address" defaultValue={initial?.address ?? ""} />
          </div>

          <div className="space-y-3">
            <CheckboxField
              id="isDefault"
              label={t("warehouseIsDefault")}
              defaultChecked={initial?.isDefault ?? false}
            />
            <CheckboxField
              id="isActive"
              label={t("isActive")}
              defaultChecked={initial?.isActive ?? true}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{tCommon("save")}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
