"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import {
  warehouseSchema,
  readFormData,
  type ActionResult,
} from "@/lib/master-data-schemas";

function normalize(formData: FormData) {
  const raw = readFormData(formData, ["isActive", "isDefault"]);
  if (typeof raw.code === "string") raw.code = raw.code.trim().toUpperCase();
  for (const k of ["name", "address"]) {
    if (typeof raw[k] === "string") raw[k] = (raw[k] as string).trim();
  }
  return raw;
}

async function clearOtherDefaults(orgId: string, exceptId?: string) {
  await prisma.warehouse.updateMany({
    where: { organizationId: orgId, isDefault: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    data: { isDefault: false },
  });
}

export async function createWarehouseAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create warehouse");

  const raw = normalize(formData);
  const parsed = warehouseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.warehouse.updateMany({
          where: { organizationId: session.organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }
      await tx.warehouse.create({
        data: {
          organizationId: session.organizationId,
          code: parsed.data.code,
          name: parsed.data.name,
          address: parsed.data.address?.length ? parsed.data.address : null,
          isDefault: parsed.data.isDefault,
          isActive: parsed.data.isActive,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "CODE_TAKEN" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/warehouses`);
  redirect(`/${locale}/warehouses`);
}

export async function updateWarehouseAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "update warehouse");

  const raw = normalize(formData);
  const parsed = warehouseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.warehouse.updateMany({
          where: { organizationId: session.organizationId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      const result = await tx.warehouse.updateMany({
        where: { id, organizationId: session.organizationId },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          address: parsed.data.address?.length ? parsed.data.address : null,
          isDefault: parsed.data.isDefault,
          isActive: parsed.data.isActive,
        },
      });
      if (result.count === 0) {
        throw new Error("NOT_FOUND");
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { ok: false, error: "NOT_FOUND" };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "CODE_TAKEN" };
    }
    throw err;
  }

  // Unused but keeps the helper exported so future flows can reuse it.
  void clearOtherDefaults;

  revalidatePath(`/${locale}/warehouses`);
  redirect(`/${locale}/warehouses`);
}
