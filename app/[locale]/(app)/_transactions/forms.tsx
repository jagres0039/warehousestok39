"use client";

import { useActionState, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { BarcodeScanner } from "@/components/barcode/barcode-scanner";
import type { ActionResult } from "@/lib/transaction-schemas";

export interface BatchOption {
  id: string;
  batchCode: string;
  expiryDate: string | null; // ISO date or null
  // On-hand at the source warehouse (for Issue/Adjustment/Transfer pickers).
  // Receipt forms ignore this and let users pick any active batch.
  onHand?: number;
}

export interface ItemOption {
  id: string;
  sku: string;
  name: string;
  unitCode: string;
  barcode: string | null;
  tracksBatch?: boolean;
  // Existing active batches for this item, sorted FEFO when used by Issue.
  batches?: BatchOption[];
}

// Match a scanned/typed code against the item list. Barcode wins over SKU,
// both case-insensitive. Trim whitespace because hardware scanners often
// emit a trailing newline.
function findItemByCode(items: ItemOption[], code: string): ItemOption | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  return (
    items.find((it) => it.barcode && it.barcode.toLowerCase() === lower) ||
    items.find((it) => it.sku.toLowerCase() === lower)
  );
}

interface ItemPickerProps {
  value: string;
  onChange: (id: string) => void;
  items: ItemOption[];
  noItemsLabel: string;
  scanLabel: string;
  onOpenScan: () => void;
}

interface BatchPickerProps {
  value: string; // batchId
  onChange: (id: string) => void;
  batches: BatchOption[];
  required: boolean;
  placeholder: string;
  showOnHand?: boolean;
}

function BatchPicker({ value, onChange, batches, required, placeholder, showOnHand }: BatchPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
      required={required}
    >
      <option value="">{placeholder}</option>
      {batches.map((b) => {
        const expiry = b.expiryDate ? new Date(b.expiryDate).toISOString().slice(0, 10) : null;
        const onHandLabel = showOnHand && b.onHand != null ? ` · ${b.onHand}` : "";
        const expiryLabel = expiry ? ` · exp ${expiry}` : "";
        return (
          <option key={b.id} value={b.id}>
            {b.batchCode}
            {expiryLabel}
            {onHandLabel}
          </option>
        );
      })}
    </select>
  );
}

interface ReceiptBatchCellProps {
  mode: "existing" | "new";
  batchId: string;
  newBatchCode: string;
  newBatchExpiry: string;
  batches: BatchOption[];
  onModeChange: (m: "existing" | "new") => void;
  onBatchIdChange: (id: string) => void;
  onNewCodeChange: (s: string) => void;
  onNewExpiryChange: (s: string) => void;
  selectExistingLabel: string;
  newBatchLabel: string;
  batchCodeLabel: string;
  expiryLabel: string;
  pickBatchLabel: string;
}

function ReceiptBatchCell(props: ReceiptBatchCellProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            checked={props.mode === "existing"}
            onChange={() => props.onModeChange("existing")}
          />
          {props.selectExistingLabel}
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            checked={props.mode === "new"}
            onChange={() => props.onModeChange("new")}
          />
          {props.newBatchLabel}
        </label>
      </div>
      {props.mode === "existing" ? (
        <BatchPicker
          value={props.batchId}
          onChange={props.onBatchIdChange}
          batches={props.batches}
          required
          placeholder={props.pickBatchLabel}
        />
      ) : (
        <div className="grid grid-cols-2 gap-1">
          <Input
            value={props.newBatchCode}
            onChange={(e) => props.onNewCodeChange(e.target.value)}
            placeholder={props.batchCodeLabel}
            required
          />
          <Input
            type="date"
            value={props.newBatchExpiry}
            onChange={(e) => props.onNewExpiryChange(e.target.value)}
            placeholder={props.expiryLabel}
            title={props.expiryLabel}
          />
        </div>
      )}
    </div>
  );
}

function ItemPicker({ value, onChange, items, noItemsLabel, scanLabel, onOpenScan }: ItemPickerProps) {
  return (
    <div className="flex items-stretch gap-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        required
      >
        {items.length === 0 ? (
          <option value="">{noItemsLabel}</option>
        ) : (
          items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.sku} — {it.name} ({it.unitCode})
            </option>
          ))
        )}
      </select>
      <button
        type="button"
        onClick={onOpenScan}
        aria-label={scanLabel}
        title={scanLabel}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border bg-background px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ScanLine className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
}

export interface PartyOption {
  id: string;
  code: string;
  name: string;
}

interface ReceiptLineState {
  uid: string;
  itemId: string;
  qty: string;
  note: string;
  // Batch fields. Used only when the chosen item.tracksBatch === true.
  batchMode: "existing" | "new";
  batchId: string;
  newBatchCode: string;
  newBatchExpiry: string;
}

let nextUid = 1;
const makeUid = () => `l${nextUid++}`;

function todayIsoLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface ReceiptFormProps {
  locale: string;
  warehouses: WarehouseOption[];
  suppliers: PartyOption[];
  items: ItemOption[];
  defaultWarehouseId?: string;
  action: (
    state: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function GoodsReceiptForm({
  locale,
  warehouses,
  suppliers,
  items,
  defaultWarehouseId,
  action,
}: ReceiptFormProps) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const tMaster = useTranslations("masterData");

  const blankLine = (): ReceiptLineState => ({
    uid: makeUid(),
    itemId: items[0]?.id ?? "",
    qty: "",
    note: "",
    batchMode: "new",
    batchId: "",
    newBatchCode: "",
    newBatchExpiry: "",
  });
  const [lines, setLines] = useState<ReceiptLineState[]>([blankLine()]);
  const [scanningUid, setScanningUid] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const updateLine = (uid: string, patch: Partial<ReceiptLineState>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const handleScanResult = useCallback(
    (code: string) => {
      const match = findItemByCode(items, code);
      if (match && scanningUid) {
        updateLine(scanningUid, { itemId: match.id });
        setScanError(null);
        setScanningUid(null);
      } else {
        setScanError(code);
      }
    },
    [items, scanningUid],
  );

  const itemById = new Map(items.map((it) => [it.id, it]));
  const anyTracksBatch = items.some((it) => it.tracksBatch);

  const linesPayload = JSON.stringify(
    lines.map((l) => {
      const item = itemById.get(l.itemId);
      const tracks = !!item?.tracksBatch;
      if (!tracks) {
        return { itemId: l.itemId, qty: l.qty, note: l.note };
      }
      if (l.batchMode === "existing") {
        return { itemId: l.itemId, batchId: l.batchId, qty: l.qty, note: l.note };
      }
      return {
        itemId: l.itemId,
        qty: l.qty,
        note: l.note,
        newBatch: {
          batchCode: l.newBatchCode,
          expiryDate: l.newBatchExpiry || null,
        },
      };
    }),
  );

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>{t("receiptCreateTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="lines" value={linesPayload} />
        <CardContent className="space-y-6">
          {state?.error === "EMPTY_LINES" && (
            <p className="text-sm text-destructive">{t("errEmptyLines")}</p>
          )}
          {state?.error === "INVALID_QTY" && (
            <p className="text-sm text-destructive">{t("errInvalidQty")}</p>
          )}
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-destructive">{t("errInvalidRef")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warehouseId">{t("warehouse")}</Label>
              <select
                id="warehouseId"
                name="warehouseId"
                defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplierId">{t("supplierOptional")}</Label>
              <select
                id="supplierId"
                name="supplierId"
                defaultValue=""
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{tMaster("categoryNone")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">{t("occurredAt")}</Label>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="datetime-local"
                defaultValue={todayIsoLocal()}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">{t("noteLabel")}</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("linesTitle")}</h3>
              <button
                type="button"
                onClick={addLine}
                className="rounded-md border border-border px-3 py-1 text-sm transition-colors hover:bg-muted/40"
              >
                + {t("addLine")}
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t("item")}</th>
                    {anyTracksBatch && <th className="w-72 px-3 py-2">{t("batch")}</th>}
                    <th className="w-32 px-3 py-2">{t("qty")}</th>
                    <th className="px-3 py-2">{t("lineNote")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l) => {
                    const item = itemById.get(l.itemId);
                    const tracks = !!item?.tracksBatch;
                    return (
                    <tr key={l.uid} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <ItemPicker
                          value={l.itemId}
                          onChange={(id) => updateLine(l.uid, { itemId: id })}
                          items={items}
                          noItemsLabel={t("noItems")}
                          scanLabel={t("scanItem")}
                          onOpenScan={() => {
                            setScanError(null);
                            setScanningUid(l.uid);
                          }}
                        />
                      </td>
                      {anyTracksBatch && (
                        <td className="px-3 py-2">
                          {tracks ? (
                            <ReceiptBatchCell
                              mode={l.batchMode}
                              batchId={l.batchId}
                              newBatchCode={l.newBatchCode}
                              newBatchExpiry={l.newBatchExpiry}
                              batches={item?.batches ?? []}
                              onModeChange={(m) => updateLine(l.uid, { batchMode: m })}
                              onBatchIdChange={(id) => updateLine(l.uid, { batchId: id })}
                              onNewCodeChange={(s) => updateLine(l.uid, { newBatchCode: s })}
                              onNewExpiryChange={(s) => updateLine(l.uid, { newBatchExpiry: s })}
                              selectExistingLabel={t("batchExisting")}
                              newBatchLabel={t("batchNew")}
                              batchCodeLabel={t("batchCode")}
                              expiryLabel={t("expiryDate")}
                              pickBatchLabel={t("pickBatch")}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("noBatch")}</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <Input
                          value={l.qty}
                          onChange={(e) => updateLine(l.uid, { qty: e.target.value })}
                          placeholder="0"
                          inputMode="decimal"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={l.note}
                          onChange={(e) => updateLine(l.uid, { note: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.uid)}
                          disabled={lines.length === 1}
                          className="text-xs text-destructive hover:underline disabled:opacity-30"
                        >
                          {tCommon("delete")}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {state?.error === "BATCH_REQUIRED" && (
              <p className="text-sm text-destructive">{t("errBatchRequired")}</p>
            )}
            {state?.error === "BATCH_NOT_ALLOWED" && (
              <p className="text-sm text-destructive">{t("errBatchNotAllowed")}</p>
            )}
            {scanError && (
              <p className="text-sm text-destructive">
                {t("scanNoMatch", { code: scanError })}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{t("postReceipt")}</SubmitButton>
        </CardFooter>
      </form>
      <BarcodeScanner
        open={scanningUid !== null}
        onClose={() => setScanningUid(null)}
        onResult={handleScanResult}
        title={t("scanItem")}
        description={t("scanItemHint")}
        manualLabel={t("scanManualLabel")}
        manualPlaceholder={t("scanManualPlaceholder")}
        manualSubmit={t("scanManualSubmit")}
        permissionDeniedLabel={t("scanPermissionDenied")}
        noCameraLabel={t("scanNoCamera")}
        startingLabel={t("scanStarting")}
        closeLabel={tCommon("cancel")}
      />
    </Card>
  );
}

interface IssueFormProps extends Omit<ReceiptFormProps, "suppliers"> {
  customers: PartyOption[];
}

export function GoodsIssueForm({
  locale,
  warehouses,
  customers,
  items,
  defaultWarehouseId,
  action,
}: IssueFormProps) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const tMaster = useTranslations("masterData");

  const blankLine = (): ReceiptLineState => ({
    uid: makeUid(),
    itemId: items[0]?.id ?? "",
    qty: "",
    note: "",
    batchMode: "existing",
    batchId: "",
    newBatchCode: "",
    newBatchExpiry: "",
  });
  const [lines, setLines] = useState<ReceiptLineState[]>([blankLine()]);
  const [scanningUid, setScanningUid] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const updateLine = (uid: string, patch: Partial<ReceiptLineState>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const handleScanResult = useCallback(
    (code: string) => {
      const match = findItemByCode(items, code);
      if (match && scanningUid) {
        updateLine(scanningUid, { itemId: match.id });
        setScanError(null);
        setScanningUid(null);
      } else {
        setScanError(code);
      }
    },
    [items, scanningUid],
  );

  const itemById = new Map(items.map((it) => [it.id, it]));
  const anyTracksBatch = items.some((it) => it.tracksBatch);

  const linesPayload = JSON.stringify(
    lines.map((l) => {
      const item = itemById.get(l.itemId);
      const tracks = !!item?.tracksBatch;
      if (!tracks) return { itemId: l.itemId, qty: l.qty, note: l.note };
      return { itemId: l.itemId, batchId: l.batchId, qty: l.qty, note: l.note };
    }),
  );

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>{t("issueCreateTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="lines" value={linesPayload} />
        <CardContent className="space-y-6">
          {state?.error === "EMPTY_LINES" && (
            <p className="text-sm text-destructive">{t("errEmptyLines")}</p>
          )}
          {state?.error === "INVALID_QTY" && (
            <p className="text-sm text-destructive">{t("errInvalidQty")}</p>
          )}
          {state?.error === "INSUFFICIENT_STOCK" && (
            <p className="text-sm text-destructive">{t("errInsufficientStock")}</p>
          )}
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-destructive">{t("errInvalidRef")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warehouseId">{t("warehouse")}</Label>
              <select
                id="warehouseId"
                name="warehouseId"
                defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerId">{t("customerOptional")}</Label>
              <select
                id="customerId"
                name="customerId"
                defaultValue=""
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{tMaster("categoryNone")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">{t("occurredAt")}</Label>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="datetime-local"
                defaultValue={todayIsoLocal()}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">{t("noteLabel")}</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("linesTitle")}</h3>
              <button
                type="button"
                onClick={addLine}
                className="rounded-md border border-border px-3 py-1 text-sm transition-colors hover:bg-muted/40"
              >
                + {t("addLine")}
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t("item")}</th>
                    {anyTracksBatch && <th className="w-56 px-3 py-2">{t("batch")}</th>}
                    <th className="w-32 px-3 py-2">{t("qty")}</th>
                    <th className="px-3 py-2">{t("lineNote")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l) => {
                    const item = itemById.get(l.itemId);
                    const tracks = !!item?.tracksBatch;
                    return (
                    <tr key={l.uid} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <ItemPicker
                          value={l.itemId}
                          onChange={(id) => updateLine(l.uid, { itemId: id })}
                          items={items}
                          noItemsLabel={t("noItems")}
                          scanLabel={t("scanItem")}
                          onOpenScan={() => {
                            setScanError(null);
                            setScanningUid(l.uid);
                          }}
                        />
                      </td>
                      {anyTracksBatch && (
                        <td className="px-3 py-2">
                          {tracks ? (
                            <BatchPicker
                              value={l.batchId}
                              onChange={(id) => updateLine(l.uid, { batchId: id })}
                              batches={item?.batches ?? []}
                              required
                              placeholder={t("pickBatch")}
                              showOnHand
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("noBatch")}</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <Input
                          value={l.qty}
                          onChange={(e) => updateLine(l.uid, { qty: e.target.value })}
                          placeholder="0"
                          inputMode="decimal"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={l.note}
                          onChange={(e) => updateLine(l.uid, { note: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.uid)}
                          disabled={lines.length === 1}
                          className="text-xs text-destructive hover:underline disabled:opacity-30"
                        >
                          {tCommon("delete")}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {state?.error === "BATCH_REQUIRED" && (
              <p className="text-sm text-destructive">{t("errBatchRequired")}</p>
            )}
            {state?.error === "BATCH_NOT_ALLOWED" && (
              <p className="text-sm text-destructive">{t("errBatchNotAllowed")}</p>
            )}
            {scanError && (
              <p className="text-sm text-destructive">
                {t("scanNoMatch", { code: scanError })}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{t("postIssue")}</SubmitButton>
        </CardFooter>
      </form>
      <BarcodeScanner
        open={scanningUid !== null}
        onClose={() => setScanningUid(null)}
        onResult={handleScanResult}
        title={t("scanItem")}
        description={t("scanItemHint")}
        manualLabel={t("scanManualLabel")}
        manualPlaceholder={t("scanManualPlaceholder")}
        manualSubmit={t("scanManualSubmit")}
        permissionDeniedLabel={t("scanPermissionDenied")}
        noCameraLabel={t("scanNoCamera")}
        startingLabel={t("scanStarting")}
        closeLabel={tCommon("cancel")}
      />
    </Card>
  );
}

interface AdjustmentLineState {
  uid: string;
  itemId: string;
  direction: "IN" | "OUT";
  qty: string;
  note: string;
  batchId: string;
}

interface AdjustmentFormProps {
  locale: string;
  warehouses: WarehouseOption[];
  items: ItemOption[];
  defaultWarehouseId?: string;
  action: (
    state: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function StockAdjustmentForm({
  locale,
  warehouses,
  items,
  defaultWarehouseId,
  action,
}: AdjustmentFormProps) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");

  const blankLine = (): AdjustmentLineState => ({
    uid: makeUid(),
    itemId: items[0]?.id ?? "",
    direction: "IN",
    qty: "",
    note: "",
    batchId: "",
  });
  const [lines, setLines] = useState<AdjustmentLineState[]>([blankLine()]);
  const [scanningUid, setScanningUid] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const updateLine = (uid: string, patch: Partial<AdjustmentLineState>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const handleScanResult = useCallback(
    (code: string) => {
      const match = findItemByCode(items, code);
      if (match && scanningUid) {
        updateLine(scanningUid, { itemId: match.id });
        setScanError(null);
        setScanningUid(null);
      } else {
        setScanError(code);
      }
    },
    [items, scanningUid],
  );

  const itemById = new Map(items.map((it) => [it.id, it]));
  const anyTracksBatch = items.some((it) => it.tracksBatch);

  const linesPayload = JSON.stringify(
    lines.map((l) => {
      const item = itemById.get(l.itemId);
      const tracks = !!item?.tracksBatch;
      if (!tracks) {
        return {
          itemId: l.itemId,
          direction: l.direction,
          qty: l.qty,
          note: l.note,
        };
      }
      return {
        itemId: l.itemId,
        batchId: l.batchId,
        direction: l.direction,
        qty: l.qty,
        note: l.note,
      };
    }),
  );

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>{t("adjustmentCreateTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="lines" value={linesPayload} />
        <CardContent className="space-y-6">
          {state?.error === "EMPTY_LINES" && (
            <p className="text-sm text-destructive">{t("errEmptyLines")}</p>
          )}
          {state?.error === "INVALID_QTY" && (
            <p className="text-sm text-destructive">{t("errInvalidQty")}</p>
          )}
          {state?.error === "INSUFFICIENT_STOCK" && (
            <p className="text-sm text-destructive">{t("errInsufficientStock")}</p>
          )}
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-destructive">{t("errInvalidRef")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warehouseId">{t("warehouse")}</Label>
              <select
                id="warehouseId"
                name="warehouseId"
                defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">{t("occurredAt")}</Label>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="datetime-local"
                defaultValue={todayIsoLocal()}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">{t("reasonLabel")}</Label>
            <Textarea id="reason" name="reason" rows={2} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("linesTitle")}</h3>
              <button
                type="button"
                onClick={addLine}
                className="rounded-md border border-border px-3 py-1 text-sm transition-colors hover:bg-muted/40"
              >
                + {t("addLine")}
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t("item")}</th>
                    {anyTracksBatch && <th className="w-56 px-3 py-2">{t("batch")}</th>}
                    <th className="w-32 px-3 py-2">{t("direction")}</th>
                    <th className="w-28 px-3 py-2">{t("qty")}</th>
                    <th className="px-3 py-2">{t("lineNote")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l) => {
                    const item = itemById.get(l.itemId);
                    const tracks = !!item?.tracksBatch;
                    return (
                    <tr key={l.uid} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <ItemPicker
                          value={l.itemId}
                          onChange={(id) => updateLine(l.uid, { itemId: id })}
                          items={items}
                          noItemsLabel={t("noItems")}
                          scanLabel={t("scanItem")}
                          onOpenScan={() => {
                            setScanError(null);
                            setScanningUid(l.uid);
                          }}
                        />
                      </td>
                      {anyTracksBatch && (
                        <td className="px-3 py-2">
                          {tracks ? (
                            <BatchPicker
                              value={l.batchId}
                              onChange={(id) => updateLine(l.uid, { batchId: id })}
                              batches={item?.batches ?? []}
                              required
                              placeholder={t("pickBatch")}
                              showOnHand
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("noBatch")}</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <select
                          value={l.direction}
                          onChange={(e) =>
                            updateLine(l.uid, {
                              direction: e.target.value as "IN" | "OUT",
                            })
                          }
                          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="IN">{t("directionIn")}</option>
                          <option value="OUT">{t("directionOut")}</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={l.qty}
                          onChange={(e) => updateLine(l.uid, { qty: e.target.value })}
                          placeholder="0"
                          inputMode="decimal"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={l.note}
                          onChange={(e) => updateLine(l.uid, { note: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.uid)}
                          disabled={lines.length === 1}
                          className="text-xs text-destructive hover:underline disabled:opacity-30"
                        >
                          {tCommon("delete")}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {state?.error === "BATCH_REQUIRED" && (
              <p className="text-sm text-destructive">{t("errBatchRequired")}</p>
            )}
            {state?.error === "BATCH_NOT_ALLOWED" && (
              <p className="text-sm text-destructive">{t("errBatchNotAllowed")}</p>
            )}
            {scanError && (
              <p className="text-sm text-destructive">
                {t("scanNoMatch", { code: scanError })}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{t("postAdjustment")}</SubmitButton>
        </CardFooter>
      </form>
      <BarcodeScanner
        open={scanningUid !== null}
        onClose={() => setScanningUid(null)}
        onResult={handleScanResult}
        title={t("scanItem")}
        description={t("scanItemHint")}
        manualLabel={t("scanManualLabel")}
        manualPlaceholder={t("scanManualPlaceholder")}
        manualSubmit={t("scanManualSubmit")}
        permissionDeniedLabel={t("scanPermissionDenied")}
        noCameraLabel={t("scanNoCamera")}
        startingLabel={t("scanStarting")}
        closeLabel={tCommon("cancel")}
      />
    </Card>
  );
}

interface TransferFormProps {
  locale: string;
  warehouses: WarehouseOption[];
  items: ItemOption[];
  defaultFromWarehouseId?: string;
  defaultToWarehouseId?: string;
  action: (
    state: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function StockTransferForm({
  locale,
  warehouses,
  items,
  defaultFromWarehouseId,
  defaultToWarehouseId,
  action,
}: TransferFormProps) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const tTransfers = useTranslations("transfers");

  const blankLine = (): ReceiptLineState => ({
    uid: makeUid(),
    itemId: items[0]?.id ?? "",
    qty: "",
    note: "",
    batchMode: "existing",
    batchId: "",
    newBatchCode: "",
    newBatchExpiry: "",
  });
  const [lines, setLines] = useState<ReceiptLineState[]>([blankLine()]);
  const [scanningUid, setScanningUid] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const updateLine = (uid: string, patch: Partial<ReceiptLineState>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const handleScanResult = useCallback(
    (code: string) => {
      const match = findItemByCode(items, code);
      if (match && scanningUid) {
        updateLine(scanningUid, { itemId: match.id });
        setScanError(null);
        setScanningUid(null);
      } else {
        setScanError(code);
      }
    },
    [items, scanningUid],
  );

  const itemById = new Map(items.map((it) => [it.id, it]));
  const anyTracksBatch = items.some((it) => it.tracksBatch);

  const linesPayload = JSON.stringify(
    lines.map((l) => {
      const item = itemById.get(l.itemId);
      const tracks = !!item?.tracksBatch;
      if (!tracks) return { itemId: l.itemId, qty: l.qty, note: l.note };
      return { itemId: l.itemId, batchId: l.batchId, qty: l.qty, note: l.note };
    }),
  );

  // Pick default destination different from default source. Falls back to the
  // first warehouse other than the default-source one.
  const initialFrom = defaultFromWarehouseId ?? warehouses[0]?.id ?? "";
  const initialTo =
    defaultToWarehouseId ??
    warehouses.find((w) => w.id !== initialFrom)?.id ??
    warehouses[1]?.id ??
    "";

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>{tTransfers("createTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="lines" value={linesPayload} />
        <CardContent className="space-y-6">
          {state?.error === "EMPTY_LINES" && (
            <p className="text-sm text-destructive">{t("errEmptyLines")}</p>
          )}
          {state?.error === "INVALID_QTY" && (
            <p className="text-sm text-destructive">{t("errInvalidQty")}</p>
          )}
          {state?.error === "INSUFFICIENT_STOCK" && (
            <p className="text-sm text-destructive">{t("errInsufficientStock")}</p>
          )}
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-destructive">{t("errInvalidRef")}</p>
          )}
          {state?.error === "SAME_WAREHOUSE" && (
            <p className="text-sm text-destructive">{tTransfers("errSameWarehouse")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fromWarehouseId">{tTransfers("from")}</Label>
              <select
                id="fromWarehouseId"
                name="fromWarehouseId"
                defaultValue={initialFrom}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toWarehouseId">{tTransfers("to")}</Label>
              <select
                id="toWarehouseId"
                name="toWarehouseId"
                defaultValue={initialTo}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">{t("occurredAt")}</Label>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="datetime-local"
                defaultValue={todayIsoLocal()}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">{t("noteLabel")}</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("linesTitle")}</h3>
              <button
                type="button"
                onClick={addLine}
                className="rounded-md border border-border px-3 py-1 text-sm transition-colors hover:bg-muted/40"
              >
                + {t("addLine")}
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-border shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t("item")}</th>
                    {anyTracksBatch && <th className="w-56 px-3 py-2">{t("batch")}</th>}
                    <th className="w-32 px-3 py-2">{t("qty")}</th>
                    <th className="px-3 py-2">{t("lineNote")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l) => {
                    const item = itemById.get(l.itemId);
                    const tracks = !!item?.tracksBatch;
                    return (
                    <tr key={l.uid} className="transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <ItemPicker
                          value={l.itemId}
                          onChange={(id) => updateLine(l.uid, { itemId: id })}
                          items={items}
                          noItemsLabel={t("noItems")}
                          scanLabel={t("scanItem")}
                          onOpenScan={() => {
                            setScanError(null);
                            setScanningUid(l.uid);
                          }}
                        />
                      </td>
                      {anyTracksBatch && (
                        <td className="px-3 py-2">
                          {tracks ? (
                            <BatchPicker
                              value={l.batchId}
                              onChange={(id) => updateLine(l.uid, { batchId: id })}
                              batches={item?.batches ?? []}
                              required
                              placeholder={t("pickBatch")}
                              showOnHand
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("noBatch")}</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <Input
                          value={l.qty}
                          onChange={(e) => updateLine(l.uid, { qty: e.target.value })}
                          placeholder="0"
                          inputMode="decimal"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={l.note}
                          onChange={(e) => updateLine(l.uid, { note: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.uid)}
                          disabled={lines.length === 1}
                          className="text-xs text-destructive hover:underline disabled:opacity-30"
                        >
                          {tCommon("delete")}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {state?.error === "BATCH_REQUIRED" && (
              <p className="text-sm text-destructive">{t("errBatchRequired")}</p>
            )}
            {state?.error === "BATCH_NOT_ALLOWED" && (
              <p className="text-sm text-destructive">{t("errBatchNotAllowed")}</p>
            )}
            {scanError && (
              <p className="text-sm text-destructive">
                {t("scanNoMatch", { code: scanError })}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{tTransfers("postAction")}</SubmitButton>
        </CardFooter>
      </form>
      <BarcodeScanner
        open={scanningUid !== null}
        onClose={() => setScanningUid(null)}
        onResult={handleScanResult}
        title={t("scanItem")}
        description={t("scanItemHint")}
        manualLabel={t("scanManualLabel")}
        manualPlaceholder={t("scanManualPlaceholder")}
        manualSubmit={t("scanManualSubmit")}
        permissionDeniedLabel={t("scanPermissionDenied")}
        noCameraLabel={t("scanNoCamera")}
        startingLabel={t("scanStarting")}
        closeLabel={tCommon("cancel")}
      />
    </Card>
  );
}
