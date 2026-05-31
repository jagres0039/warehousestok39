"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { previewDocumentNumber } from "@/lib/doc-numbering";
import type { ActionResult } from "@/lib/master-data-schemas";
import { updateDocNumberingAction } from "./actions";

interface DocNumberingFormProps {
  locale: string;
  canEdit: boolean;
  docType: string;
  orgSlug: string;
  currentCounter: number;
  initial: {
    template: string;
    resetPolicy: "never" | "yearly" | "monthly";
  };
}

const POLICIES: ReadonlyArray<"never" | "yearly" | "monthly"> = [
  "never",
  "yearly",
  "monthly",
];

export function DocNumberingForm({
  locale,
  canEdit,
  docType,
  orgSlug,
  currentCounter,
  initial,
}: DocNumberingFormProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const boundAction = updateDocNumberingAction.bind(null, docType);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    boundAction,
    undefined,
  );

  const [template, setTemplate] = useState(initial.template);

  const previewSample = useMemo(() => {
    const sampleCounter = currentCounter + 1 || 1;
    try {
      return previewDocumentNumber(template, orgSlug.toUpperCase(), sampleCounter);
    } catch {
      return "";
    }
  }, [template, orgSlug, currentCounter]);

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(`docType_${docType}` as const)}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.ok ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {t("savedNotice")}
            </p>
          ) : null}
          {state?.error === "NOT_FOUND" ? (
            <p className="text-sm text-red-600">{tCommon("notFound")}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="template">{t("template")}</Label>
            <Input
              id="template"
              name="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={!canEdit}
              spellCheck={false}
              autoComplete="off"
              required
            />
            {fieldError("template") ? (
              <p className="text-xs text-red-600">{fieldError("template")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
            )}
          </div>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("preview")}
            </span>
            <div className="mt-1 font-mono text-base text-foreground">
              {previewSample || "—"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("previewHint", { counter: (currentCounter + 1).toString() })}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resetPolicy">{t("resetPolicy")}</Label>
            <select
              id="resetPolicy"
              name="resetPolicy"
              defaultValue={initial.resetPolicy}
              disabled={!canEdit}
              className="h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {POLICIES.map((p) => (
                <option key={p} value={p}>
                  {t(`resetPolicy_${p}` as const)}
                </option>
              ))}
            </select>
            {fieldError("resetPolicy") ? (
              <p className="text-xs text-red-600">{fieldError("resetPolicy")}</p>
            ) : null}
          </div>

          <PlaceholderHelp />
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

function PlaceholderHelp() {
  const t = useTranslations("settings");
  const rows = [
    { token: "{YYYY}", desc: t("ph_YYYY") },
    { token: "{YY}", desc: t("ph_YY") },
    { token: "{MM}", desc: t("ph_MM") },
    { token: "{DD}", desc: t("ph_DD") },
    { token: "{SEQ:N}", desc: t("ph_SEQ") },
    { token: "{ORG}", desc: t("ph_ORG") },
  ];
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("placeholders")}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {rows.map((r) => (
          <li key={r.token} className="flex gap-3">
            <span className="font-mono text-foreground">{r.token}</span>
            <span>{r.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
