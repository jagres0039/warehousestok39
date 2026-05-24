"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import {
  itemSchema,
  readFormData,
  type ActionResult,
} from "@/lib/master-data-schemas";

function normalize(formData: FormData) {
  const raw = readFormData(formData, ["isActive"]);
  if (typeof raw.sku === "string") raw.sku = raw.sku.trim().toUpperCase();
  if (typeof raw.name === "string") raw.name = raw.name.trim();
  if (typeof raw.barcode === "string") raw.barcode = raw.barcode.trim();
  if (typeof raw.description === "string") raw.description = raw.description.trim();
  if (typeof raw.imageUrl === "string") raw.imageUrl = raw.imageUrl.trim();
  if (typeof raw.categoryId === "string") raw.categoryId = raw.categoryId.trim();
  if (typeof raw.unitId === "string") raw.unitId = raw.unitId.trim();
  return raw;
}

async function validateRefs(orgId: string, categoryId: string | null, unitId: string) {
  const [cat, unit] = await Promise.all([
    categoryId
      ? prisma.category.findFirst({
          where: { id: categoryId, organizationId: orgId },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.unit.findFirst({
      where: { id: unitId, organizationId: orgId },
      select: { id: true },
    }),
  ]);
  if (categoryId && !cat) return "INVALID_CATEGORY" as const;
  if (!unit) return "INVALID_UNIT" as const;
  return null;
}

function mapPrismaUniqueError(err: unknown): ActionResult | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = err.meta?.target;
    const fields = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
    if (fields.includes("barcode")) return { ok: false, error: "BARCODE_TAKEN" };
    return { ok: false, error: "SKU_TAKEN" };
  }
  return null;
}

export async function createItemAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create item");

  const raw = normalize(formData);
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const refError = await validateRefs(
    session.organizationId,
    parsed.data.categoryId || null,
    parsed.data.unitId,
  );
  if (refError) return { ok: false, error: refError };

  try {
    await prisma.item.create({
      data: {
        organizationId: session.organizationId,
        sku: parsed.data.sku,
        name: parsed.data.name,
        description: parsed.data.description?.length ? parsed.data.description : null,
        barcode: parsed.data.barcode?.length ? parsed.data.barcode : null,
        categoryId: parsed.data.categoryId?.length ? parsed.data.categoryId : null,
        unitId: parsed.data.unitId,
        minStock: parsed.data.minStock,
        imageUrl: parsed.data.imageUrl?.length ? parsed.data.imageUrl : null,
        isActive: parsed.data.isActive,
      },
    });
  } catch (err) {
    const mapped = mapPrismaUniqueError(err);
    if (mapped) return mapped;
    throw err;
  }

  revalidatePath(`/${locale}/items`);
  redirect(`/${locale}/items`);
}

export async function updateItemAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "update item");

  const raw = normalize(formData);
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const refError = await validateRefs(
    session.organizationId,
    parsed.data.categoryId || null,
    parsed.data.unitId,
  );
  if (refError) return { ok: false, error: refError };

  try {
    const result = await prisma.item.updateMany({
      where: { id, organizationId: session.organizationId },
      data: {
        sku: parsed.data.sku,
        name: parsed.data.name,
        description: parsed.data.description?.length ? parsed.data.description : null,
        barcode: parsed.data.barcode?.length ? parsed.data.barcode : null,
        categoryId: parsed.data.categoryId?.length ? parsed.data.categoryId : null,
        unitId: parsed.data.unitId,
        minStock: parsed.data.minStock,
        imageUrl: parsed.data.imageUrl?.length ? parsed.data.imageUrl : null,
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { ok: false, error: "NOT_FOUND" };
    }
  } catch (err) {
    const mapped = mapPrismaUniqueError(err);
    if (mapped) return mapped;
    throw err;
  }

  revalidatePath(`/${locale}/items`);
  redirect(`/${locale}/items`);
}
