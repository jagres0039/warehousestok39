"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/transaction-schemas";

export interface ItemOption {
  id: string;
  sku: string;
  name: string;
  unitCode: string;
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

  const [lines, setLines] = useState<ReceiptLineState[]>([
    { uid: makeUid(), itemId: items[0]?.id ?? "", qty: "", note: "" },
  ]);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const updateLine = (uid: string, patch: Partial<ReceiptLineState>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  const addLine = () =>
    setLines((prev) => [...prev, { uid: makeUid(), itemId: items[0]?.id ?? "", qty: "", note: "" }]);

  const linesPayload = JSON.stringify(
    lines.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("receiptCreateTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="lines" value={linesPayload} />
        <CardContent className="space-y-6">
          {state?.error === "EMPTY_LINES" && (
            <p className="text-sm text-red-600">{t("errEmptyLines")}</p>
          )}
          {state?.error === "INVALID_QTY" && (
            <p className="text-sm text-red-600">{t("errInvalidQty")}</p>
          )}
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-red-600">{t("errInvalidRef")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warehouseId">{t("warehouse")}</Label>
              <select
                id="warehouseId"
                name="warehouseId"
                defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
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
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
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
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
              >
                + {t("addLine")}
              </button>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("item")}</th>
                    <th className="w-32 px-3 py-2">{t("qty")}</th>
                    <th className="px-3 py-2">{t("lineNote")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.uid}>
                      <td className="px-3 py-2">
                        <select
                          value={l.itemId}
                          onChange={(e) => updateLine(l.uid, { itemId: e.target.value })}
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                          required
                        >
                          {items.length === 0 ? (
                            <option value="">{t("noItems")}</option>
                          ) : (
                            items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.sku} — {it.name} ({it.unitCode})
                              </option>
                            ))
                          )}
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
                          className="text-xs text-red-600 hover:underline disabled:opacity-30"
                        >
                          {tCommon("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{t("postReceipt")}</SubmitButton>
        </CardFooter>
      </form>
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

  const [lines, setLines] = useState<ReceiptLineState[]>([
    { uid: makeUid(), itemId: items[0]?.id ?? "", qty: "", note: "" },
  ]);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const updateLine = (uid: string, patch: Partial<ReceiptLineState>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  const addLine = () =>
    setLines((prev) => [...prev, { uid: makeUid(), itemId: items[0]?.id ?? "", qty: "", note: "" }]);

  const linesPayload = JSON.stringify(
    lines.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("issueCreateTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="lines" value={linesPayload} />
        <CardContent className="space-y-6">
          {state?.error === "EMPTY_LINES" && (
            <p className="text-sm text-red-600">{t("errEmptyLines")}</p>
          )}
          {state?.error === "INVALID_QTY" && (
            <p className="text-sm text-red-600">{t("errInvalidQty")}</p>
          )}
          {state?.error === "INSUFFICIENT_STOCK" && (
            <p className="text-sm text-red-600">{t("errInsufficientStock")}</p>
          )}
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-red-600">{t("errInvalidRef")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warehouseId">{t("warehouse")}</Label>
              <select
                id="warehouseId"
                name="warehouseId"
                defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
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
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
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
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
              >
                + {t("addLine")}
              </button>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("item")}</th>
                    <th className="w-32 px-3 py-2">{t("qty")}</th>
                    <th className="px-3 py-2">{t("lineNote")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.uid}>
                      <td className="px-3 py-2">
                        <select
                          value={l.itemId}
                          onChange={(e) => updateLine(l.uid, { itemId: e.target.value })}
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                          required
                        >
                          {items.length === 0 ? (
                            <option value="">{t("noItems")}</option>
                          ) : (
                            items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.sku} — {it.name} ({it.unitCode})
                              </option>
                            ))
                          )}
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
                          className="text-xs text-red-600 hover:underline disabled:opacity-30"
                        >
                          {tCommon("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{t("postIssue")}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

interface AdjustmentLineState {
  uid: string;
  itemId: string;
  direction: "IN" | "OUT";
  qty: string;
  note: string;
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

  const [lines, setLines] = useState<AdjustmentLineState[]>([
    { uid: makeUid(), itemId: items[0]?.id ?? "", direction: "IN", qty: "", note: "" },
  ]);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    action,
    undefined,
  );

  const updateLine = (uid: string, patch: Partial<AdjustmentLineState>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  const removeLine = (uid: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { uid: makeUid(), itemId: items[0]?.id ?? "", direction: "IN", qty: "", note: "" },
    ]);

  const linesPayload = JSON.stringify(
    lines.map((l) => ({
      itemId: l.itemId,
      direction: l.direction,
      qty: l.qty,
      note: l.note,
    })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("adjustmentCreateTitle")}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="lines" value={linesPayload} />
        <CardContent className="space-y-6">
          {state?.error === "EMPTY_LINES" && (
            <p className="text-sm text-red-600">{t("errEmptyLines")}</p>
          )}
          {state?.error === "INVALID_QTY" && (
            <p className="text-sm text-red-600">{t("errInvalidQty")}</p>
          )}
          {state?.error === "INSUFFICIENT_STOCK" && (
            <p className="text-sm text-red-600">{t("errInsufficientStock")}</p>
          )}
          {state?.error === "INVALID_REF" && (
            <p className="text-sm text-red-600">{t("errInvalidRef")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warehouseId">{t("warehouse")}</Label>
              <select
                id="warehouseId"
                name="warehouseId"
                defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
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
                className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
              >
                + {t("addLine")}
              </button>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("item")}</th>
                    <th className="w-32 px-3 py-2">{t("direction")}</th>
                    <th className="w-28 px-3 py-2">{t("qty")}</th>
                    <th className="px-3 py-2">{t("lineNote")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.uid}>
                      <td className="px-3 py-2">
                        <select
                          value={l.itemId}
                          onChange={(e) => updateLine(l.uid, { itemId: e.target.value })}
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                          required
                        >
                          {items.length === 0 ? (
                            <option value="">{t("noItems")}</option>
                          ) : (
                            items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.sku} — {it.name} ({it.unitCode})
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={l.direction}
                          onChange={(e) =>
                            updateLine(l.uid, {
                              direction: e.target.value as "IN" | "OUT",
                            })
                          }
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
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
                          className="text-xs text-red-600 hover:underline disabled:opacity-30"
                        >
                          {tCommon("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <SubmitButton pendingLabel={tCommon("saving")}>{t("postAdjustment")}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
