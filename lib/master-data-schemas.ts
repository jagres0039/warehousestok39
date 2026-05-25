import { z } from "zod";

// Common shape for many master-data modules: code + name + isActive.
const codeRegex = /^[A-Z0-9-]+$/;

export const unitSchema = z.object({
  code: z.string().min(1).max(16).regex(codeRegex, "Use uppercase letters, digits, or '-'"),
  name: z.string().min(1).max(80),
  isActive: z.boolean().default(true),
});
export type UnitInput = z.infer<typeof unitSchema>;

export const categorySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const itemSchema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().or(z.literal("")),
  barcode: z.string().max(40).optional().or(z.literal("")),
  categoryId: z.string().min(1).optional().or(z.literal("")),
  unitId: z.string().min(1, "Unit is required"),
  minStock: z.coerce.number().min(0).default(0),
  imageUrl: z.string().url().max(500).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type ItemInput = z.infer<typeof itemSchema>;

export const partnerSchema = z.object({
  code: z.string().min(1).max(20).regex(codeRegex, "Use uppercase letters, digits, or '-'"),
  name: z.string().min(1).max(120),
  contactName: z.string().max(80).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().max(120).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
export type PartnerInput = z.infer<typeof partnerSchema>;

export const warehouseSchema = z.object({
  code: z.string().min(1).max(20).regex(codeRegex, "Use uppercase letters, digits, or '-'"),
  name: z.string().min(1).max(120),
  address: z.string().max(500).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type WarehouseInput = z.infer<typeof warehouseSchema>;

// FormDataEntries -> object, treating checkbox absence as `false`.
export function readFormData(formData: FormData, checkboxes: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  for (const cb of checkboxes) {
    out[cb] = formData.get(cb) === "on" || formData.get(cb) === "true";
  }
  return out;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
