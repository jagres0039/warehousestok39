"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import {
  unitSchema,
  readFormData,
  type ActionResult,
} from "@/lib/master-data-schemas";

async function loadContext(locale: string) {
  const session = await requireTenantSession(locale);
  return session;
}

export async function createUnitAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await loadContext(locale);
  assertCanMutate(session.role, "create unit");

  const raw = readFormData(formData, ["isActive"]);
  if (typeof raw.code === "string") raw.code = raw.code.trim().toUpperCase();
  if (typeof raw.name === "string") raw.name = raw.name.trim();

  const parsed = unitSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.unit.create({
      data: {
        organizationId: session.organizationId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "CODE_TAKEN" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/units`);
  redirect(`/${locale}/units`);
}

export async function updateUnitAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await loadContext(locale);
  assertCanMutate(session.role, "update unit");

  const raw = readFormData(formData, ["isActive"]);
  if (typeof raw.code === "string") raw.code = raw.code.trim().toUpperCase();
  if (typeof raw.name === "string") raw.name = raw.name.trim();

  const parsed = unitSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    const result = await prisma.unit.updateMany({
      where: { id, organizationId: session.organizationId },
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { ok: false, error: "NOT_FOUND" };
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "CODE_TAKEN" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/units`);
  redirect(`/${locale}/units`);
}

export async function toggleUnitActiveAction(id: string, locale: string) {
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "archive unit");

  const unit = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { isActive: true },
  });
  if (!unit) return;

  await prisma.unit.updateMany({
    where: { id, organizationId: session.organizationId },
    data: { isActive: !unit.isActive },
  });

  revalidatePath(`/${locale}/units`);
}
