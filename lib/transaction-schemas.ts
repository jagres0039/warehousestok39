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

export const cancelSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type ReceiptLineInputForm = z.infer<typeof receiptLineSchema>;
export type IssueLineInputForm = z.infer<typeof issueLineSchema>;
export type AdjustmentLineInputForm = z.infer<typeof adjustmentLineSchema>;
