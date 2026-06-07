import { z } from "zod";

export interface ActionResult<F = string> {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string;
  data?: F;
}

const decimalString = z
  .string()
  .trim()
  .min(1)
  .refine((s) => /^-?\d+(\.\d+)?$/.test(s), {
    message: "Must be a number (use . for decimals)",
  })
  .transform((s) => parseFloat(s));

export const receiptLineSchema = z.object({
  itemId: z.string().min(1),
  qty: decimalString.refine((n) => n > 0, { message: "Qty must be > 0" }),
  note: z.string().trim().max(255).optional().nullable(),
});

export const issueLineSchema = receiptLineSchema;

export const adjustmentLineSchema = z.object({
  itemId: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  qty: decimalString.refine((n) => n > 0, { message: "Qty must be > 0" }),
  note: z.string().trim().max(255).optional().nullable(),
});

export const receiptHeaderSchema = z.object({
  warehouseId: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  occurredAt: z.string().min(1),
  note: z.string().trim().max(500).optional().nullable(),
});

export const issueHeaderSchema = z.object({
  warehouseId: z.string().min(1),
  customerId: z.string().optional().nullable(),
  occurredAt: z.string().min(1),
  note: z.string().trim().max(500).optional().nullable(),
});

export const adjustmentHeaderSchema = z.object({
  warehouseId: z.string().min(1),
  occurredAt: z.string().min(1),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const transferLineSchema = z.object({
  itemId: z.string().min(1),
  qty: decimalString.refine((n) => n > 0, { message: "Qty must be > 0" }),
  note: z.string().trim().max(255).optional().nullable(),
});

export const transferHeaderSchema = z
  .object({
    fromWarehouseId: z.string().min(1),
    toWarehouseId: z.string().min(1),
    occurredAt: z.string().min(1),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    message: "Source and destination warehouses must differ",
    path: ["toWarehouseId"],
  });

// Header for creating an opname draft. Counted-quantity edits and the post
// step have their own light-weight schemas because they don't use a shared
// form action.
export const opnameHeaderSchema = z.object({
  warehouseId: z.string().min(1),
  note: z.string().trim().max(500).optional().nullable(),
});

// Counted quantity must be a non-negative decimal (the system already enforces
// non-negative on-hand via ledger sums; allowing negative counted-qty would
// be nonsensical for a physical count).
const countedDecimal = z
  .string()
  .trim()
  .min(1)
  .refine((s) => /^\d+(\.\d+)?$/.test(s), {
    message: "Must be a non-negative number",
  })
  .transform((s) => parseFloat(s));

export const opnameLineUpdateSchema = z.object({
  itemId: z.string().min(1),
  countedQty: countedDecimal,
  note: z.string().trim().max(255).optional().nullable(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type ReceiptLineInputForm = z.infer<typeof receiptLineSchema>;
export type IssueLineInputForm = z.infer<typeof issueLineSchema>;
export type AdjustmentLineInputForm = z.infer<typeof adjustmentLineSchema>;
export type TransferLineInputForm = z.infer<typeof transferLineSchema>;
export type OpnameLineUpdateInputForm = z.infer<typeof opnameLineUpdateSchema>;
