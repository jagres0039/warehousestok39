"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { CheckboxField } from "../units/UnitForm";
import { createItemAction, updateItemAction } from "./actions";
import type { ActionResult } from "@/lib/master-data-schemas";

interface ItemFormProps {
  locale: string;
  mode: "create" | "edit";
  initial?: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    barcode: string | null;
    categoryId: string | null;
    unitId: string;
    minStock: string;
    imageUrl: string | null;
    isActive: boolean;
  };
  categories: Array<{ id: string; name: string }>;
  units: Array<{ id: string; code: string; name: string }>;
}

export function ItemForm({ locale, mode, initial, categories, units }: ItemFormProps) {
  const t = useTranslations("masterData");
  const tCommon = useTranslations("common");

  const action =
    mode === "edit" && initial
      ? updateItemAction.bind(null, initial.id)
      : createItemAction;
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const fieldError = (name: keyof NonNullable<ActionResult["fieldErrors"]>) =>
    state?.fieldErrors?.[name]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "create" ? t("itemCreateTitle") : t("itemEditTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.error === "SKU_TAKEN" && (
            <p className="text-sm text-red-600">{t("skuTaken")}</p>
          )}
          {state?.error === "BARCODE_TAKEN" && (
            <p className="text-sm text-red-600">{t("barcodeTaken")}</p>
          )}
          {state?.error === "INVALID_CATEGORY" && (
            <p className="text-sm text-red-600">{t("invalidCategory")}</p>
          )}
          {state?.error === "INVALID_UNIT" && (
            <p className="text-sm text-red-600">{t("invalidUnit")}</p>
          )}
          {state?.error === "NOT_FOUND" && (
            <p className="text-sm text-red-600">{tCommon("notFound")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sku">{t("sku")}</Label>
              <Input id="sku" name="sku" defaultValue={initial?.sku ?? ""} required />
              {fieldError("sku") && <p className="text-xs text-red-600">{fieldError("sku")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="barcode">{t("barcode")}</Label>
              <Input
                id="barcode"
                name="barcode"
                defaultValue={initial?.barcode ?? ""}
                placeholder={t("barcodeHint")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
            {fieldError("name") && <p className="text-xs text-red-600">{fieldError("name")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">{t("category")}</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={initial?.categoryId ?? ""}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <option value="">{t("categoryNone")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unitId">{t("unit")}</Label>
              <select
                id="unitId"
                name="unitId"
                defaultValue={initial?.unitId ?? ""}
                required
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <option value="" disabled>
                  {t("unitPlaceholder")}
                </option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
              {fieldError("unitId") && <p className="text-xs text-red-600">{fieldError("unitId")}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="minStock">{t("minStock")}</Label>
              <Input
                id="minStock"
                name="minStock"
                type="number"
                step="0.001"
                min="0"
                defaultValue={initial?.minStock ?? "0"}
              />
              {fieldError("minStock") && (
                <p className="text-xs text-red-600">{fieldError("minStock")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imageUrl">{t("imageUrl")}</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                defaultValue={initial?.imageUrl ?? ""}
                placeholder="https://..."
              />
              {fieldError("imageUrl") && (
                <p className="text-xs text-red-600">{fieldError("imageUrl")}</p>
              )}
            </div>
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
