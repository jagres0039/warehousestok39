"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/transaction-schemas";
import { createStockOpnameAction } from "./actions";

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

interface Props {
  locale: string;
  warehouses: WarehouseOption[];
  defaultWarehouseId: string;
}

export function CreateOpnameForm({ locale, warehouses, defaultWarehouseId }: Props) {
  const t = useTranslations("opnames");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    createStockOpnameAction,
    undefined,
  );

  return (
    <Card>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-red-600">{t("errInvalidRef")}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="warehouseId">{t("warehouse")}</Label>
            <select
              id="warehouseId"
              name="warehouseId"
              defaultValue={defaultWarehouseId}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              required
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("snapshotHelp")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">{t("noteLabel")}</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{t("createDraftAction")}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
