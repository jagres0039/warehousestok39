"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScanLine, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "@/components/barcode/barcode-scanner";
import {
  updateOpnameLineAction,
  postStockOpnameAction,
  cancelStockOpnameAction,
} from "../actions";

export interface OpnameLineRow {
  itemId: string;
  sku: string;
  name: string;
  unitCode: string;
  barcode: string | null;
  systemQty: string;
  countedQty: string;
  varianceQty: string;
  note: string | null;
}

interface Props {
  locale: string;
  opnameId: string;
  isDraft: boolean;
  canMutate: boolean;
  rows: OpnameLineRow[];
}

function findItemByCode(
  rows: OpnameLineRow[],
  code: string,
): OpnameLineRow | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  return (
    rows.find((it) => it.barcode && it.barcode.toLowerCase() === lower) ||
    rows.find((it) => it.sku.toLowerCase() === lower)
  );
}

export function OpnameCountClient({
  locale,
  opnameId,
  isDraft,
  canMutate,
  rows,
}: Props) {
  const router = useRouter();
  const t = useTranslations("opnames");
  const tCommon = useTranslations("common");

  const [filter, setFilter] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [perRowError, setPerRowError] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rows;
    return rows.filter(
      (r) =>
        r.sku.toLowerCase().includes(f) ||
        r.name.toLowerCase().includes(f) ||
        (r.barcode && r.barcode.toLowerCase().includes(f)),
    );
  }, [rows, filter]);

  const totals = useMemo(() => {
    let counted = 0;
    let variance = 0;
    let mismatches = 0;
    for (const r of rows) {
      counted += Number(r.countedQty);
      const v = Number(r.varianceQty);
      variance += v;
      if (v !== 0) mismatches += 1;
    }
    return { counted, variance, mismatches };
  }, [rows]);

  function handleSave(row: OpnameLineRow, value: string) {
    if (!isDraft) return;
    const trimmed = value.trim();
    if (trimmed === "") {
      setPerRowError((prev) => ({ ...prev, [row.itemId]: t("errEmptyQty") }));
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      setPerRowError((prev) => ({ ...prev, [row.itemId]: t("errInvalidQty") }));
      return;
    }
    setPerRowError((prev) => {
      const c = { ...prev };
      delete c[row.itemId];
      return c;
    });
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("itemId", row.itemId);
    fd.set("countedQty", trimmed);
    setSavingItemId(row.itemId);
    setSavedItemId(null);
    startTransition(async () => {
      const result = await updateOpnameLineAction(opnameId, undefined, fd);
      setSavingItemId(null);
      if (result?.ok) {
        setSavedItemId(row.itemId);
        router.refresh();
        // Clear "saved" indicator after a beat.
        setTimeout(() => setSavedItemId((c) => (c === row.itemId ? null : c)), 1500);
      } else {
        setPerRowError((prev) => ({
          ...prev,
          [row.itemId]: t("errSaveFailed"),
        }));
      }
    });
  }

  function handleScan(code: string) {
    const match = findItemByCode(rows, code);
    if (match) {
      setFilter(match.sku);
      setScannerOpen(false);
      setScanError(null);
      // Scroll the matched row into view.
      setTimeout(() => {
        const el = document.getElementById(`opname-row-${match.itemId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = el.querySelector<HTMLInputElement>("input[name='countedQty']");
          input?.focus();
          input?.select();
        }
      }, 50);
    } else {
      setScanError(code);
    }
  }

  function handlePost() {
    setPostError(null);
    const fd = new FormData();
    fd.set("locale", locale);
    startTransition(async () => {
      const result = await postStockOpnameAction(opnameId, undefined, fd);
      if (result?.ok) {
        setConfirmPost(false);
        router.refresh();
      } else {
        setPostError(result?.error ?? "UNKNOWN");
      }
    });
  }

  function handleCancel(reason: string) {
    if (!reason.trim()) return;
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("reason", reason.trim());
    startTransition(async () => {
      const result = await cancelStockOpnameAction(opnameId, undefined, fd);
      if (result?.ok) {
        router.refresh();
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-base">{t("countTitle")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("countSummary", {
                lineCount: rows.length,
                mismatches: totals.mismatches,
                variance: totals.variance,
              })}
            </p>
          </div>
          {isDraft && canMutate ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setScanError(null);
                  setScannerOpen(true);
                }}
              >
                <ScanLine className="mr-1.5 size-4" />
                {t("scanItemAction")}
              </Button>
              <Button
                onClick={() => setConfirmPost(true)}
                disabled={pending}
                size="sm"
              >
                {t("postAction")}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("filterPlaceholder")}
              className="pl-8 pr-8"
            />
            {filter ? (
              <button
                type="button"
                onClick={() => setFilter("")}
                aria-label={tCommon("clear")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {scanError ? (
            <p className="text-sm text-destructive">
              {t("scanNoMatch", { code: scanError })}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t("colItem")}</th>
                  <th className="w-28 px-3 py-2 text-right">{t("colSystem")}</th>
                  <th className="w-32 px-3 py-2 text-right">{t("colCounted")}</th>
                  <th className="w-28 px-3 py-2 text-right">{t("colVariance")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      {tCommon("noResults")}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const variance = Number(row.varianceQty);
                    return (
                      <tr key={row.itemId} id={`opname-row-${row.itemId}`}>
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs text-muted-foreground">
                            {row.sku}
                          </div>
                          <div>{row.name}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {Number(row.systemQty).toLocaleString(locale)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isDraft && canMutate ? (
                            <CountedInput
                              defaultValue={row.countedQty}
                              onSave={(v) => handleSave(row, v)}
                              saving={savingItemId === row.itemId}
                              saved={savedItemId === row.itemId}
                              error={perRowError[row.itemId]}
                            />
                          ) : (
                            <span className="font-mono">
                              {Number(row.countedQty).toLocaleString(locale)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          <span
                            className={
                              variance > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : variance < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                            }
                          >
                            {variance > 0 ? "+" : ""}
                            {Number(row.varianceQty).toLocaleString(locale)}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {row.unitCode}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {isDraft && canMutate ? (
            <div className="flex justify-end pt-2">
              <CancelDraftButton
                label={t("cancelDraftAction")}
                dialogTitle={t("cancelDialogTitle")}
                reasonLabel={t("cancelReasonLabel")}
                cancelLabel={tCommon("cancel")}
                confirmLabel={t("cancelConfirmAction")}
                onSubmit={handleCancel}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={handleScan}
        title={t("scanItemAction")}
        description={t("scanItemHint")}
        manualLabel={t("scanManualLabel")}
        manualPlaceholder={t("scanManualPlaceholder")}
        manualSubmit={t("scanManualSubmit")}
        permissionDeniedLabel={t("scanPermissionDenied")}
        noCameraLabel={t("scanNoCamera")}
        startingLabel={t("scanStarting")}
        closeLabel={tCommon("cancel")}
      />

      {confirmPost ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">{t("postDialogTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                {t("postDialogBody", {
                  mismatches: totals.mismatches,
                  variance: totals.variance,
                })}
              </p>
              {postError ? (
                <p className="text-sm text-destructive">{t("errPostFailed")}</p>
              ) : null}
            </CardContent>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <Button
                variant="outline"
                onClick={() => setConfirmPost(false)}
                disabled={pending}
              >
                {tCommon("cancel")}
              </Button>
              <Button onClick={handlePost} disabled={pending}>
                {t("postConfirmAction")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

interface CountedInputProps {
  defaultValue: string;
  onSave: (value: string) => void;
  saving: boolean;
  saved: boolean;
  error: string | undefined;
}

function CountedInput({ defaultValue, onSave, saving, saved, error }: CountedInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-col items-end gap-1">
      <Input
        name="countedQty"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== defaultValue) onSave(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        inputMode="decimal"
        className="w-24 text-right font-mono"
      />
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : saving ? (
        <Badge variant="muted" className="text-[10px]">…</Badge>
      ) : saved ? (
        <Badge variant="success" className="text-[10px]">✓</Badge>
      ) : null}
    </div>
  );
}

interface CancelDraftButtonProps {
  label: string;
  dialogTitle: string;
  reasonLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onSubmit: (reason: string) => void;
}

function CancelDraftButton({
  label,
  dialogTitle,
  reasonLabel,
  cancelLabel,
  confirmLabel,
  onSubmit,
}: CancelDraftButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        {label}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">{dialogTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="space-y-1.5">
                <span className="text-sm text-muted-foreground">{reasonLabel}</span>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </label>
            </CardContent>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                type="button"
              >
                {cancelLabel}
              </Button>
              <Button
                onClick={() => {
                  onSubmit(reason);
                  setOpen(false);
                }}
                disabled={!reason.trim()}
              >
                {confirmLabel}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
