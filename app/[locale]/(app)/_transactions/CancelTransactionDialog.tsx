"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/transaction-schemas";

interface CancelDialogProps {
  triggerLabel: string;
  title: string;
  locale: string;
  action: (
    state: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function CancelTransactionDialog({
  triggerLabel,
  title,
  locale,
  action,
}: CancelDialogProps) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    async (prev, formData) => {
      const next = await action(prev, formData);
      if (next.ok) {
        setOpen(false);
      }
      return next;
    },
    undefined,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            action={formAction}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <input type="hidden" name="locale" value={locale} />
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("cancelDialogBody")}</p>
            {state?.error === "REASON_REQUIRED" && (
              <p className="mt-2 text-sm text-red-600">{t("cancelReasonRequired")}</p>
            )}
            {state?.error === "INSUFFICIENT_STOCK" && (
              <p className="mt-2 text-sm text-red-600">{t("errInsufficientStockCancel")}</p>
            )}
            {state?.error === "ALREADY_CANCELED" && (
              <p className="mt-2 text-sm text-red-600">{t("alreadyCanceled")}</p>
            )}
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="reason">{t("cancelReason")}</Label>
              <Textarea id="reason" name="reason" rows={3} required />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {tCommon("cancel")}
              </button>
              <SubmitButton
                pendingLabel={tCommon("saving")}
                className="bg-red-600 hover:bg-red-700"
              >
                {t("confirmCancel")}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
