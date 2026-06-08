/**
 * Shared validation helpers for line-level batch references.
 *
 * Used by goods-issue, stock-adjustment, stock-transfer and stock-opname
 * actions where the operator selects an EXISTING batch (no on-the-fly batch
 * creation -- that's only allowed in goods receipts).
 *
 * Returns a discriminated result. On error the caller maps the code to a
 * standard ActionResult error message.
 */
import { prisma } from "@/lib/prisma";

export type BatchValidationError =
  | "BATCH_REQUIRED"
  | "BATCH_NOT_ALLOWED"
  | "INVALID_REF";

export interface BatchValidationOk {
  ok: true;
}
export interface BatchValidationFail {
  ok: false;
  error: BatchValidationError;
}
export type BatchValidationResult = BatchValidationOk | BatchValidationFail;

/**
 * For a list of lines that already reference items in the same tenant,
 * verify that:
 *   - if item.tracksBatch, batchId is required and refers to an active
 *     batch belonging to that item in this tenant.
 *   - if !item.tracksBatch, batchId must be null.
 */
export async function validateBatchReferences(
  organizationId: string,
  lines: Array<{ itemId: string; batchId: string | null }>,
  itemsById: Map<string, { tracksBatch: boolean }>,
): Promise<BatchValidationResult> {
  for (const line of lines) {
    const item = itemsById.get(line.itemId);
    if (!item) return { ok: false, error: "INVALID_REF" };
    if (item.tracksBatch) {
      if (!line.batchId) return { ok: false, error: "BATCH_REQUIRED" };
    } else {
      if (line.batchId) return { ok: false, error: "BATCH_NOT_ALLOWED" };
    }
  }

  const refBatchIds = Array.from(
    new Set(lines.map((l) => l.batchId).filter((b): b is string => !!b)),
  );
  if (refBatchIds.length === 0) return { ok: true };

  const batches = await prisma.itemBatch.findMany({
    where: {
      organizationId,
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
  return { ok: true };
}
