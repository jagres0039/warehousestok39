"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import {
  postGoodsIssue,
  cancelGoodsIssue,
  InsufficientStockError,
} from "@/lib/inventory";
import {
  issueHeaderSchema,
  issueLineSchema,
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

export async function createGoodsIssueAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create goods issue");

  const header = issueHeaderSchema.safeParse({
    warehouseId: String(formData.get("warehouseId") ?? ""),
    customerId: String(formData.get("customerId") ?? "") || null,
    occurredAt: String(formData.get("occurredAt") ?? ""),
    note: String(formData.get("note") ?? "") || null,
  });
  if (!header.success) {
    return {
      ok: false,
      fieldErrors: header.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const linesRaw = parseLines(String(formData.get("lines") ?? "[]"));
  if (linesRaw.length === 0) return { ok: false, error: "EMPTY_LINES" };
  const parsedLines = linesRaw.map((l) => issueLineSchema.safeParse(l));
  if (parsedLines.some((r) => !r.success)) {
    return { ok: false, error: "INVALID_QTY" };
  }
  const lines = parsedLines
    .filter(
      (
        r,
      ): r is {
        success: true;
        data: { itemId: string; batchId: string | null; qty: number; note?: string | null };
      } => r.success,
    )
    .map((r) => r.data);

  const [wh, cust, items, org] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: header.data.warehouseId, organizationId: session.organizationId, isActive: true },
    }),
    header.data.customerId
      ? prisma.customer.findFirst({
          where: { id: header.data.customerId, organizationId: session.organizationId, isActive: true },
        })
      : Promise.resolve(null),
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
  if (!wh) return { ok: false, error: "INVALID_REF" };
  if (header.data.customerId && !cust) return { ok: false, error: "INVALID_REF" };
  if (!org) return { ok: false, error: "INVALID_REF" };
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
    await postGoodsIssue({
      organizationId: session.organizationId,
      orgSlug: org.slug,
      createdById: session.userId,
      warehouseId: header.data.warehouseId,
      customerId: header.data.customerId ?? null,
      occurredAt: new Date(header.data.occurredAt),
      note: header.data.note ?? undefined,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        batchId: l.batchId,
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

  revalidatePath(`/${locale}/goods-issues`);
  revalidatePath(`/${locale}/stock`);
  redirect(`/${locale}/goods-issues`);
}

export async function cancelGoodsIssueAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "cancel goods issue");
  const parsed = cancelSchema.safeParse({ reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  try {
    await cancelGoodsIssue(id, {
      organizationId: session.organizationId,
      canceledById: session.userId,
      reason: parsed.data.reason,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
      if (err.message === "ALREADY_CANCELED") return { ok: false, error: "ALREADY_CANCELED" };
    }
    throw err;
  }
  revalidatePath(`/${locale}/goods-issues`);
  revalidatePath(`/${locale}/goods-issues/${id}`);
  revalidatePath(`/${locale}/stock`);
  return { ok: true };
}
