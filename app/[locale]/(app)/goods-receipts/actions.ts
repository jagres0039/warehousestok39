"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import {
  postGoodsReceipt,
  cancelGoodsReceipt,
  InsufficientStockError,
} from "@/lib/inventory";
import {
  receiptHeaderSchema,
  receiptLineSchema,
  cancelSchema,
  type ActionResult,
} from "@/lib/transaction-schemas";

function parseLines(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createGoodsReceiptAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create goods receipt");

  const headerRaw = {
    warehouseId: String(formData.get("warehouseId") ?? ""),
    supplierId: String(formData.get("supplierId") ?? "") || null,
    occurredAt: String(formData.get("occurredAt") ?? ""),
    note: String(formData.get("note") ?? "") || null,
  };
  const header = receiptHeaderSchema.safeParse(headerRaw);
  if (!header.success) {
    return {
      ok: false,
      fieldErrors: header.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const linesRaw = parseLines(String(formData.get("lines") ?? "[]"));
  if (linesRaw.length === 0) return { ok: false, error: "EMPTY_LINES" };
  const parsedLines = linesRaw.map((l) => receiptLineSchema.safeParse(l));
  const failed = parsedLines.find((r) => !r.success);
  if (failed && !failed.success) {
    return { ok: false, error: "INVALID_QTY" };
  }
  const lines = parsedLines
    .filter((r): r is { success: true; data: { itemId: string; qty: number; note?: string | null } } => r.success)
    .map((r) => r.data);

  // Sanity-check refs belong to this tenant.
  const [wh, sup, items] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: header.data.warehouseId, organizationId: session.organizationId, isActive: true },
    }),
    header.data.supplierId
      ? prisma.supplier.findFirst({
          where: { id: header.data.supplierId, organizationId: session.organizationId, isActive: true },
        })
      : Promise.resolve(null),
    prisma.item.findMany({
      where: {
        organizationId: session.organizationId,
        id: { in: lines.map((l) => l.itemId) },
        isActive: true,
      },
      select: { id: true },
    }),
  ]);
  if (!wh) return { ok: false, error: "INVALID_REF" };
  if (header.data.supplierId && !sup) return { ok: false, error: "INVALID_REF" };
  const validItems = new Set(items.map((i) => i.id));
  for (const line of lines) {
    if (!validItems.has(line.itemId)) return { ok: false, error: "INVALID_REF" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { slug: true },
  });
  if (!org) return { ok: false, error: "INVALID_REF" };

  try {
    await postGoodsReceipt({
      organizationId: session.organizationId,
      orgSlug: org.slug,
      createdById: session.userId,
      warehouseId: header.data.warehouseId,
      supplierId: header.data.supplierId ?? null,
      occurredAt: new Date(header.data.occurredAt),
      note: header.data.note ?? undefined,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        qty: l.qty,
        note: l.note ?? undefined,
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_QTY") {
      return { ok: false, error: "INVALID_QTY" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/goods-receipts`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/goods-receipts`);
}

export async function cancelGoodsReceiptAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "cancel goods receipt");
  const parsed = cancelSchema.safeParse({ reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  try {
    await cancelGoodsReceipt(id, {
      organizationId: session.organizationId,
      canceledById: session.userId,
      reason: parsed.data.reason,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
      if (err.message === "ALREADY_CANCELED")
        return { ok: false, error: "ALREADY_CANCELED" };
    }
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "INSUFFICIENT_STOCK" };
    }
    throw err;
  }
  revalidatePath(`/${locale}/goods-receipts`);
  revalidatePath(`/${locale}/goods-receipts/${id}`);
  revalidatePath(`/${locale}/stock`);
  return { ok: true };
}
