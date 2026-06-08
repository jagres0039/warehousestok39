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
    .filter(
      (
        r,
      ): r is {
        success: true;
        data: {
          itemId: string;
          batchId: string | null;
          newBatch?: {
            batchCode: string;
            expiryDate?: string | null;
            mfgDate?: string | null;
            costPrice?: number | null;
            note?: string | null;
          } | null;
          qty: number;
          note?: string | null;
        };
      } => r.success,
    )
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
      select: { id: true, tracksBatch: true },
    }),
  ]);
  if (!wh) return { ok: false, error: "INVALID_REF" };
  if (header.data.supplierId && !sup) return { ok: false, error: "INVALID_REF" };
  const itemsById = new Map(items.map((i) => [i.id, i]));
  for (const line of lines) {
    if (!itemsById.has(line.itemId)) return { ok: false, error: "INVALID_REF" };
  }

  // Validate batch shape per item: batch-tracked items must have either an
  // existing batchId or a newBatch payload; non-batch items must have neither.
  for (const line of lines) {
    const item = itemsById.get(line.itemId)!;
    if (item.tracksBatch) {
      if (!line.batchId && !line.newBatch) return { ok: false, error: "BATCH_REQUIRED" };
    } else {
      if (line.batchId || line.newBatch) return { ok: false, error: "BATCH_NOT_ALLOWED" };
    }
  }

  // Verify referenced existing batches belong to the right item + tenant.
  const refBatchIds = lines
    .filter((l) => l.batchId)
    .map((l) => l.batchId as string);
  if (refBatchIds.length > 0) {
    const batches = await prisma.itemBatch.findMany({
      where: {
        organizationId: session.organizationId,
        id: { in: refBatchIds },
        isActive: true,
      },
      select: { id: true, itemId: true },
    });
    const batchById = new Map(batches.map((b) => [b.id, b]));
    for (const line of lines) {
      if (!line.batchId) continue;
      const b = batchById.get(line.batchId);
      if (!b || b.itemId !== line.itemId) return { ok: false, error: "INVALID_REF" };
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { slug: true },
  });
  if (!org) return { ok: false, error: "INVALID_REF" };

  // Materialize newBatch payloads into ItemBatch rows BEFORE posting the
  // receipt so the ledger can FK to them. We use upsert keyed on
  // (organizationId, itemId, batchCode) so re-submits don't create dupes.
  const resolvedBatchIdByLineIdx = new Map<number, string | null>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.newBatch) {
      const created = await prisma.itemBatch.upsert({
        where: {
          organizationId_itemId_batchCode: {
            organizationId: session.organizationId,
            itemId: line.itemId,
            batchCode: line.newBatch.batchCode,
          },
        },
        create: {
          organizationId: session.organizationId,
          itemId: line.itemId,
          batchCode: line.newBatch.batchCode,
          expiryDate: line.newBatch.expiryDate ? new Date(line.newBatch.expiryDate) : null,
          mfgDate: line.newBatch.mfgDate ? new Date(line.newBatch.mfgDate) : null,
          costPrice: line.newBatch.costPrice != null ? line.newBatch.costPrice : null,
          note: line.newBatch.note ?? null,
        },
        update: {
          // Backfill expiry/mfg/cost only when the existing record is empty.
          expiryDate: line.newBatch.expiryDate ? new Date(line.newBatch.expiryDate) : undefined,
          mfgDate: line.newBatch.mfgDate ? new Date(line.newBatch.mfgDate) : undefined,
          costPrice: line.newBatch.costPrice != null ? line.newBatch.costPrice : undefined,
        },
        select: { id: true },
      });
      resolvedBatchIdByLineIdx.set(i, created.id);
    } else {
      resolvedBatchIdByLineIdx.set(i, line.batchId);
    }
  }

  try {
    await postGoodsReceipt({
      organizationId: session.organizationId,
      orgSlug: org.slug,
      createdById: session.userId,
      warehouseId: header.data.warehouseId,
      supplierId: header.data.supplierId ?? null,
      occurredAt: new Date(header.data.occurredAt),
      note: header.data.note ?? undefined,
      lines: lines.map((l, i) => ({
        itemId: l.itemId,
        batchId: resolvedBatchIdByLineIdx.get(i) ?? null,
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
