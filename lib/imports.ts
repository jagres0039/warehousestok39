/**
 * Shared types and validators for CSV bulk-import of master data. Used by
 * both the client preview (papaparse output) and the server actions
 * (defence in depth — never trust client validation alone).
 */

import { z } from "zod";

export type ImportEntity = "items" | "suppliers" | "customers" | "categories" | "warehouses";

export const IMPORT_ENTITIES: ImportEntity[] = [
  "items",
  "suppliers",
  "customers",
  "categories",
  "warehouses",
];

const trimmedString = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1).max(max));

const optionalString = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v.length === 0 ? null : v))
    .pipe(z.string().max(max).nullable());

const optionalDecimal = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim())
  .transform((v) => (v.length === 0 ? "0" : v))
  .pipe(z.string().regex(/^\d+(\.\d{1,3})?$/, "Must be a number with up to 3 decimals"));

export const ItemImportSchema = z.object({
  sku: trimmedString(64),
  name: trimmedString(255),
  barcode: optionalString(64),
  unit_code: trimmedString(16),
  category_name: optionalString(255),
  min_stock: optionalDecimal,
  description: optionalString(2000),
});
export type ItemImportRow = z.infer<typeof ItemImportSchema>;

const partySchema = z.object({
  code: trimmedString(32),
  name: trimmedString(255),
  contact_name: optionalString(255),
  phone: optionalString(32),
  email: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v.length === 0 ? null : v))
    .pipe(z.string().email().max(255).nullable()),
  address: optionalString(500),
});
export const SupplierImportSchema = partySchema;
export const CustomerImportSchema = partySchema;
export type SupplierImportRow = z.infer<typeof SupplierImportSchema>;
export type CustomerImportRow = z.infer<typeof CustomerImportSchema>;

export const CategoryImportSchema = z.object({
  name: trimmedString(255),
  description: optionalString(2000),
});
export type CategoryImportRow = z.infer<typeof CategoryImportSchema>;

export const WarehouseImportSchema = z.object({
  code: trimmedString(32),
  name: trimmedString(255),
  address: optionalString(500),
});
export type WarehouseImportRow = z.infer<typeof WarehouseImportSchema>;

export interface EntityFieldDef {
  /** CSV header column name. */
  key: string;
  required: boolean;
  /** Short hint shown under the field name in the template / preview. */
  hint?: string;
}

export const ENTITY_FIELDS: Record<ImportEntity, EntityFieldDef[]> = {
  items: [
    { key: "sku", required: true, hint: "Unique per organization" },
    { key: "name", required: true },
    { key: "barcode", required: false, hint: "Optional, unique if set" },
    { key: "unit_code", required: true, hint: "Must match an existing unit" },
    { key: "category_name", required: false, hint: "Skipped silently if unknown" },
    { key: "min_stock", required: false, hint: "Number, default 0" },
    { key: "description", required: false },
  ],
  suppliers: [
    { key: "code", required: true, hint: "Unique per organization" },
    { key: "name", required: true },
    { key: "contact_name", required: false },
    { key: "phone", required: false },
    { key: "email", required: false },
    { key: "address", required: false },
  ],
  customers: [
    { key: "code", required: true, hint: "Unique per organization" },
    { key: "name", required: true },
    { key: "contact_name", required: false },
    { key: "phone", required: false },
    { key: "email", required: false },
    { key: "address", required: false },
  ],
  categories: [
    { key: "name", required: true, hint: "Unique per organization" },
    { key: "description", required: false },
  ],
  warehouses: [
    { key: "code", required: true, hint: "Unique per organization" },
    { key: "name", required: true },
    { key: "address", required: false },
  ],
};

export type ImportSkipReason =
  | "DUPLICATE_KEY"
  | "UNKNOWN_UNIT"
  | "INVALID_VALUE"
  | "EMPTY_ROW";

export interface ImportRowResult {
  /** 1-indexed row number within the CSV body (excluding header). */
  rowNumber: number;
  status: "created" | "skipped";
  reason?: ImportSkipReason;
  message?: string;
  /** Display value used to identify the row in summaries. */
  key?: string;
}

export interface ImportSummary {
  entity: ImportEntity;
  totalRows: number;
  created: number;
  skipped: number;
  results: ImportRowResult[];
}

/** Build a CSV template string for a given entity. Header only. */
export function buildCsvTemplate(entity: ImportEntity): string {
  const fields = ENTITY_FIELDS[entity];
  return fields.map((f) => f.key).join(",") + "\n";
}

/** Slugify a name the same way the seed script does. Lower-case + dashes. */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
