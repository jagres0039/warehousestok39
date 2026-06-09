"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import {
  postStockAdjustment,
  cancelStockAdjustment,
  InsufficientStockError,
} from "@/lib/inventory";
import {
  adjustmentHeaderSchema,
  adjustmentLineSchema,
  cancelSchema,
  type ActionResult,
} from "@/lib/transaction-schemas";
import { validateBatchReferences } from "@/lib/batch-helpers";

function parseLines(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createStockAdjustmentAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create stock adjustment");

  const header = adjustmentHeaderSchema.safeParse({
    warehouseId: String(formData.get("warehouseId") ?? ""),
    occurredAt: String(formData.get("occurredAt") ?? ""),
    reason: String(formData.get("reason") ?? "") || null,
  });
  if (!header.success) {
    return {
      ok: false,
      fieldErrors: header.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const linesRaw = parseLines(String(formData.get("lines") ?? "[]"));
  if (linesRaw.length === 0) return { ok: false, error: "EMPTY_LINES" };
  const parsedLines = linesRaw.map((l) => adjustmentLineSchema.safeParse(l));
  if (parsedLines.some((r) => !r.success)) {
    return { ok: false, error: "INVALID_QTY" };
  }
  const lines = parsedLines
    .filter(
      (
        r,
      ): r is {
        success: true;
        data: {
          itemId: string;
          batchId: string | null;
          direction: "IN" | "OUT";
          qty: number;
          note?: string | null;
        };
      } => r.success,
    )
    .map((r) => r.data);

  const [wh, items, org] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: header.data.warehouseId, organizationId: session.organizationId, isActive: true },
    }),
    prisma.item.findMany({
      where: {
        organizationId: session.organizationId,
        id: { in: lines.map((l) => l.itemId) },
        isActive: true,
      },
      select: { id: true, tracksBatch: true },
    }),
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { slug: true },
    }),
  ]);
  if (!wh || !org) return { ok: false, error: "INVALID_REF" };
  const itemsById = new Map(items.map((i) => [i.id, i]));
  for (const line of lines) {
    if (!itemsById.has(line.itemId)) return { ok: false, error: "INVALID_REF" };
  }

  const batchCheck = await validateBatchReferences(
    session.organizationId,
    lines,
    itemsById,
  );
  if (!batchCheck.ok) return { ok: false, error: batchCheck.error };

  try {
    await postStockAdjustment({
      organizationId: session.organizationId,
      orgSlug: org.slug,
      createdById: session.userId,
      warehouseId: header.data.warehouseId,
      occurredAt: new Date(header.data.occurredAt),
      reason: header.data.reason ?? undefined,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        batchId: l.batchId,
        direction: l.direction,
        qty: l.qty,
        note: l.note ?? undefined,
      })),
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "INSUFFICIENT_STOCK" };
    }
    if (err instanceof Error && err.message === "INVALID_QTY") {
      return { ok: false, error: "INVALID_QTY" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/adjustments`);
  revalidatePath(`/${locale}/stock`);
  redirect(`/${locale}/adjustments`);
}

export async function cancelStockAdjustmentAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "cancel stock adjustment");
  const parsed = cancelSchema.safeParse({ reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  try {
    await cancelStockAdjustment(id, {
      organizationId: session.organizationId,
      canceledById: session.userId,
      reason: parsed.data.reason,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
      if (err.message === "ALREADY_CANCELED") return { ok: false, error: "ALREADY_CANCELED" };
    }
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "INSUFFICIENT_STOCK" };
    }
    throw err;
  }
  revalidatePath(`/${locale}/adjustments`);
  revalidatePath(`/${locale}/adjustments/${id}`);
  revalidatePath(`/${locale}/stock`);
  return { ok: true };
}
