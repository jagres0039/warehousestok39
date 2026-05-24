"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { slugify, withRandomSuffix } from "@/lib/slug";
import {
  categorySchema,
  readFormData,
  type ActionResult,
} from "@/lib/master-data-schemas";

async function uniqueCategorySlug(orgId: string, name: string, currentId?: string): Promise<string> {
  let base = slugify(name);
  for (let i = 0; i < 6; i += 1) {
    const candidate = i === 0 ? base : withRandomSuffix(base);
    const conflict = await prisma.category.findFirst({
      where: { organizationId: orgId, slug: candidate, ...(currentId ? { NOT: { id: currentId } } : {}) },
      select: { id: true },
    });
    if (!conflict) return candidate;
    base = candidate;
  }
  return withRandomSuffix(base);
}

export async function createCategoryAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create category");

  const raw = readFormData(formData, ["isActive"]);
  if (typeof raw.name === "string") raw.name = raw.name.trim();
  if (typeof raw.description === "string") raw.description = raw.description.trim();

  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const slug = await uniqueCategorySlug(session.organizationId, parsed.data.name);

  try {
    await prisma.category.create({
      data: {
        organizationId: session.organizationId,
        name: parsed.data.name,
        slug,
        description: parsed.data.description?.length ? parsed.data.description : null,
        isActive: parsed.data.isActive,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "NAME_TAKEN" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/categories`);
  redirect(`/${locale}/categories`);
}

export async function updateCategoryAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "update category");

  const raw = readFormData(formData, ["isActive"]);
  if (typeof raw.name === "string") raw.name = raw.name.trim();
  if (typeof raw.description === "string") raw.description = raw.description.trim();

  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const current = await prisma.category.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, slug: true, name: true },
  });
  if (!current) {
    return { ok: false, error: "NOT_FOUND" };
  }

  let nextSlug = current.slug;
  if (current.name.toLowerCase() !== parsed.data.name.toLowerCase()) {
    nextSlug = await uniqueCategorySlug(session.organizationId, parsed.data.name, id);
  }

  try {
    await prisma.category.updateMany({
      where: { id, organizationId: session.organizationId },
      data: {
        name: parsed.data.name,
        slug: nextSlug,
        description: parsed.data.description?.length ? parsed.data.description : null,
        isActive: parsed.data.isActive,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "NAME_TAKEN" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/categories`);
  redirect(`/${locale}/categories`);
}
