"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanAdminister } from "@/lib/role-guard";
import {
  ItemImportSchema,
  SupplierImportSchema,
  CustomerImportSchema,
  CategoryImportSchema,
  WarehouseImportSchema,
  slugifyName,
  type ImportRowResult,
  type ImportSummary,
} from "@/lib/imports";

/**
 * Each action takes the locale (to bounce to login if needed) and an array
 * of raw row objects parsed from CSV. Returns a per-row summary. Rows that
 * fail validation OR collide with an existing record are skipped, not
 * aborted — partial imports are intentional so users can fix the rejects
 * in a follow-up upload.
 */

interface ImportInput {
  locale: string;
  rows: Array<Record<string, string>>;
}

function emptyRow(raw: Record<string, string>): boolean {
  return Object.values(raw).every((v) => (v ?? "").trim() === "");
}

export async function importItemsAction({ locale, rows }: ImportInput): Promise<ImportSummary> {
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "bulk import items");

  const results: ImportRowResult[] = [];

  const [existingItems, units, categories] = await Promise.all([
    prisma.item.findMany({
      where: { organizationId: session.organizationId },
      select: { sku: true, barcode: true },
    }),
    prisma.unit.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, code: true },
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);
  const existingSkus = new Set(existingItems.map((i) => i.sku.toLowerCase()));
  const existingBarcodes = new Set(
    existingItems.filter((i) => i.barcode).map((i) => (i.barcode as string).toLowerCase()),
  );
  const unitByCode = new Map(units.map((u) => [u.code.toLowerCase(), u.id]));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  // Track keys staged in THIS batch so we don't insert two rows with the same SKU.
  const stagedSkus = new Set<string>();
  const stagedBarcodes = new Set<string>();
  const stagedCreates: Array<Prisma.ItemUncheckedCreateInput> = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    if (emptyRow(raw)) {
      results.push({ rowNumber, status: "skipped", reason: "EMPTY_ROW" });
      return;
    }
    const parsed = ItemImportSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        rowNumber,
        status: "skipped",
        reason: "INVALID_VALUE",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }
    const data = parsed.data;
    const skuLower = data.sku.toLowerCase();
    if (existingSkus.has(skuLower) || stagedSkus.has(skuLower)) {
      results.push({ rowNumber, status: "skipped", reason: "DUPLICATE_KEY", key: data.sku });
      return;
    }
    if (data.barcode) {
      const bcLower = data.barcode.toLowerCase();
      if (existingBarcodes.has(bcLower) || stagedBarcodes.has(bcLower)) {
        results.push({ rowNumber, status: "skipped", reason: "DUPLICATE_KEY", key: data.barcode });
        return;
      }
      stagedBarcodes.add(bcLower);
    }
    const unitId = unitByCode.get(data.unit_code.toLowerCase());
    if (!unitId) {
      results.push({
        rowNumber,
        status: "skipped",
        reason: "UNKNOWN_UNIT",
        key: data.unit_code,
        message: `unit_code "${data.unit_code}" not found`,
      });
      return;
    }
    const categoryId = data.category_name
      ? categoryByName.get(data.category_name.toLowerCase()) ?? null
      : null;
    stagedSkus.add(skuLower);
    stagedCreates.push({
      organizationId: session.organizationId,
      sku: data.sku,
      name: data.name,
      description: data.description,
      barcode: data.barcode,
      unitId,
      categoryId,
      minStock: data.min_stock,
    });
    results.push({ rowNumber, status: "created", key: data.sku });
  });

  if (stagedCreates.length > 0) {
    await prisma.item.createMany({ data: stagedCreates });
    revalidatePath(`/${locale}/items`);
  }

  return finalize("items", rows.length, results);
}

export async function importSuppliersAction({
  locale,
  rows,
}: ImportInput): Promise<ImportSummary> {
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "bulk import suppliers");

  const existing = await prisma.supplier.findMany({
    where: { organizationId: session.organizationId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((s) => s.code.toLowerCase()));

  const stagedCodes = new Set<string>();
  const stagedCreates: Array<Prisma.SupplierUncheckedCreateInput> = [];
  const results: ImportRowResult[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    if (emptyRow(raw)) {
      results.push({ rowNumber, status: "skipped", reason: "EMPTY_ROW" });
      return;
    }
    const parsed = SupplierImportSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        rowNumber,
        status: "skipped",
        reason: "INVALID_VALUE",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }
    const d = parsed.data;
    const codeLower = d.code.toLowerCase();
    if (existingCodes.has(codeLower) || stagedCodes.has(codeLower)) {
      results.push({ rowNumber, status: "skipped", reason: "DUPLICATE_KEY", key: d.code });
      return;
    }
    stagedCodes.add(codeLower);
    stagedCreates.push({
      organizationId: session.organizationId,
      code: d.code,
      name: d.name,
      contactName: d.contact_name,
      phone: d.phone,
      email: d.email,
      address: d.address,
    });
    results.push({ rowNumber, status: "created", key: d.code });
  });

  if (stagedCreates.length > 0) {
    await prisma.supplier.createMany({ data: stagedCreates });
    revalidatePath(`/${locale}/suppliers`);
  }

  return finalize("suppliers", rows.length, results);
}

export async function importCustomersAction({
  locale,
  rows,
}: ImportInput): Promise<ImportSummary> {
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "bulk import customers");

  const existing = await prisma.customer.findMany({
    where: { organizationId: session.organizationId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((c) => c.code.toLowerCase()));

  const stagedCodes = new Set<string>();
  const stagedCreates: Array<Prisma.CustomerUncheckedCreateInput> = [];
  const results: ImportRowResult[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    if (emptyRow(raw)) {
      results.push({ rowNumber, status: "skipped", reason: "EMPTY_ROW" });
      return;
    }
    const parsed = CustomerImportSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        rowNumber,
        status: "skipped",
        reason: "INVALID_VALUE",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }
    const d = parsed.data;
    const codeLower = d.code.toLowerCase();
    if (existingCodes.has(codeLower) || stagedCodes.has(codeLower)) {
      results.push({ rowNumber, status: "skipped", reason: "DUPLICATE_KEY", key: d.code });
      return;
    }
    stagedCodes.add(codeLower);
    stagedCreates.push({
      organizationId: session.organizationId,
      code: d.code,
      name: d.name,
      contactName: d.contact_name,
      phone: d.phone,
      email: d.email,
      address: d.address,
    });
    results.push({ rowNumber, status: "created", key: d.code });
  });

  if (stagedCreates.length > 0) {
    await prisma.customer.createMany({ data: stagedCreates });
    revalidatePath(`/${locale}/customers`);
  }

  return finalize("customers", rows.length, results);
}

export async function importCategoriesAction({
  locale,
  rows,
}: ImportInput): Promise<ImportSummary> {
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "bulk import categories");

  const existing = await prisma.category.findMany({
    where: { organizationId: session.organizationId },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((c) => c.slug));

  const stagedSlugs = new Set<string>();
  const stagedCreates: Array<Prisma.CategoryUncheckedCreateInput> = [];
  const results: ImportRowResult[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    if (emptyRow(raw)) {
      results.push({ rowNumber, status: "skipped", reason: "EMPTY_ROW" });
      return;
    }
    const parsed = CategoryImportSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        rowNumber,
        status: "skipped",
        reason: "INVALID_VALUE",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }
    const d = parsed.data;
    const slug = slugifyName(d.name);
    if (!slug) {
      results.push({
        rowNumber,
        status: "skipped",
        reason: "INVALID_VALUE",
        message: "name produces an empty slug",
      });
      return;
    }
    if (existingSlugs.has(slug) || stagedSlugs.has(slug)) {
      results.push({ rowNumber, status: "skipped", reason: "DUPLICATE_KEY", key: d.name });
      return;
    }
    stagedSlugs.add(slug);
    stagedCreates.push({
      organizationId: session.organizationId,
      name: d.name,
      slug,
      description: d.description,
    });
    results.push({ rowNumber, status: "created", key: d.name });
  });

  if (stagedCreates.length > 0) {
    await prisma.category.createMany({ data: stagedCreates });
    revalidatePath(`/${locale}/categories`);
  }

  return finalize("categories", rows.length, results);
}

export async function importWarehousesAction({
  locale,
  rows,
}: ImportInput): Promise<ImportSummary> {
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "bulk import warehouses");

  const existing = await prisma.warehouse.findMany({
    where: { organizationId: session.organizationId },
    select: { code: true },
  });
  const existingCodes = new Set(existing.map((w) => w.code.toLowerCase()));

  const stagedCodes = new Set<string>();
  const stagedCreates: Array<Prisma.WarehouseUncheckedCreateInput> = [];
  const results: ImportRowResult[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    if (emptyRow(raw)) {
      results.push({ rowNumber, status: "skipped", reason: "EMPTY_ROW" });
      return;
    }
    const parsed = WarehouseImportSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        rowNumber,
        status: "skipped",
        reason: "INVALID_VALUE",
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }
    const d = parsed.data;
    const codeLower = d.code.toLowerCase();
    if (existingCodes.has(codeLower) || stagedCodes.has(codeLower)) {
      results.push({ rowNumber, status: "skipped", reason: "DUPLICATE_KEY", key: d.code });
      return;
    }
    stagedCodes.add(codeLower);
    stagedCreates.push({
      organizationId: session.organizationId,
      code: d.code,
      name: d.name,
      address: d.address,
    });
    results.push({ rowNumber, status: "created", key: d.code });
  });

  if (stagedCreates.length > 0) {
    await prisma.warehouse.createMany({ data: stagedCreates });
    revalidatePath(`/${locale}/warehouses`);
  }

  return finalize("warehouses", rows.length, results);
}

function finalize(
  entity: ImportSummary["entity"],
  totalRows: number,
  results: ImportRowResult[],
): ImportSummary {
  return {
    entity,
    totalRows,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  };
}
