"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import {
  createOpnameDraft,
  updateOpnameLine,
  postOpname,
  cancelOpnameDraft,
  cancelPostedOpname,
  InsufficientStockError,
} from "@/lib/inventory";
import {
  opnameHeaderSchema,
  opnameLineUpdateSchema,
  cancelSchema,
  type ActionResult,
} from "@/lib/transaction-schemas";

export async function createStockOpnameAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create stock opname");

  const header = opnameHeaderSchema.safeParse({
    warehouseId: String(formData.get("warehouseId") ?? ""),
    note: String(formData.get("note") ?? "") || null,
  });
  if (!header.success) {
    return {
      ok: false,
      fieldErrors: header.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [wh, org] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: header.data.warehouseId, organizationId: session.organizationId, isActive: true },
    }),
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { slug: true },
    }),
  ]);
  if (!wh || !org) return { ok: false, error: "INVALID_REF" };

  const result = await createOpnameDraft({
    organizationId: session.organizationId,
    orgSlug: org.slug,
    createdById: session.userId,
    warehouseId: header.data.warehouseId,
    note: header.data.note ?? undefined,
  });

  revalidatePath(`/${locale}/opnames`);
  redirect(`/${locale}/opnames/${result.id}`);
}

export async function updateOpnameLineAction(
  opnameId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "update opname line");

  const parsed = opnameLineUpdateSchema.safeParse({
    itemId: String(formData.get("itemId") ?? ""),
    countedQty: String(formData.get("countedQty") ?? ""),
    note: String(formData.get("note") ?? "") || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "INVALID_QTY",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await updateOpnameLine({
      organizationId: session.organizationId,
      opnameId,
      itemId: parsed.data.itemId,
      countedQty: parsed.data.countedQty,
      note: parsed.data.note ?? null,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
      if (err.message === "NOT_DRAFT") return { ok: false, error: "NOT_DRAFT" };
      if (err.message === "LINE_NOT_FOUND") return { ok: false, error: "LINE_NOT_FOUND" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/opnames/${opnameId}`);
  return { ok: true };
}

export async function postStockOpnameAction(
  opnameId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "post stock opname");

  try {
    await postOpname({
      organizationId: session.organizationId,
      opnameId,
      postedById: session.userId,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
      if (err.message === "NOT_DRAFT") return { ok: false, error: "NOT_DRAFT" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/opnames`);
  revalidatePath(`/${locale}/opnames/${opnameId}`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}

export async function cancelStockOpnameAction(
  opnameId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "cancel stock opname");

  const parsed = cancelSchema.safeParse({ reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) {
    return { ok: false, error: "REASON_REQUIRED" };
  }

  // Decide which path to take based on current status.
  const header = await prisma.stockOpname.findFirst({
    where: { id: opnameId, organizationId: session.organizationId },
    select: { status: true },
  });
  if (!header) return { ok: false, error: "NOT_FOUND" };

  try {
    if (header.status === "DRAFT") {
      await cancelOpnameDraft(opnameId, {
        organizationId: session.organizationId,
        canceledById: session.userId,
        reason: parsed.data.reason,
      });
    } else if (header.status === "POSTED") {
      await cancelPostedOpname(opnameId, {
        organizationId: session.organizationId,
        canceledById: session.userId,
        reason: parsed.data.reason,
      });
    } else {
      return { ok: false, error: "ALREADY_CANCELED" };
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
      if (err.message === "NOT_DRAFT") return { ok: false, error: "NOT_DRAFT" };
      if (err.message === "NOT_POSTED") return { ok: false, error: "NOT_POSTED" };
    }
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "INSUFFICIENT_STOCK" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/opnames`);
  revalidatePath(`/${locale}/opnames/${opnameId}`);
  return { ok: true };
}
