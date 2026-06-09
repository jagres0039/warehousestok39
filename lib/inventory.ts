// Inventory posting service.
//
// All stock-affecting operations go through this module so the StockLedger
// stays the single source of truth for on-hand quantities. Headers
// (GoodsReceipt, GoodsIssue, StockAdjustment) are written together with their
// matching ledger entries in a single Prisma transaction; if anything fails,
// nothing is persisted.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { issueDocumentNumber } from "@/lib/doc-numbering-service";

export interface ReceiptLineInput {
  itemId: string;
  // Required when item.tracksBatch === true, must be null otherwise.
  batchId?: string | null;
  qty: number;
  note?: string;
}

export interface IssueLineInput {
  itemId: string;
  batchId?: string | null;
  qty: number;
  note?: string;
}

export interface AdjustmentLineInput {
  itemId: string;
  batchId?: string | null;
  direction: "IN" | "OUT";
  qty: number;
  note?: string;
}

export interface PostReceiptInput {
  organizationId: string;
  orgSlug: string;
  createdById: string;
  warehouseId: string;
  supplierId?: string | null;
  occurredAt?: Date;
  note?: string;
  lines: ReceiptLineInput[];
}

export interface PostIssueInput {
  organizationId: string;
  orgSlug: string;
  createdById: string;
  warehouseId: string;
  customerId?: string | null;
  occurredAt?: Date;
  note?: string;
  lines: IssueLineInput[];
}

export interface PostAdjustmentInput {
  organizationId: string;
  orgSlug: string;
  createdById: string;
  warehouseId: string;
  occurredAt?: Date;
  reason?: string;
  lines: AdjustmentLineInput[];
}

export interface TransferLineInput {
  itemId: string;
  // Source batch (preserved at destination on transfer).
  batchId?: string | null;
  qty: number;
  note?: string;
}

export interface PostTransferInput {
  organizationId: string;
  orgSlug: string;
  createdById: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  occurredAt?: Date;
  note?: string;
  lines: TransferLineInput[];
}

export class InsufficientStockError extends Error {
  itemId: string;
  warehouseId: string;
  batchId: string | null;
  requested: number;
  available: number;
  constructor(
    itemId: string,
    warehouseId: string,
    requested: number,
    available: number,
    batchId: string | null = null,
  ) {
    const where = batchId ? `${itemId}/${batchId}` : itemId;
    super(`Insufficient stock for item ${where} in warehouse ${warehouseId}`);
    this.name = "InsufficientStockError";
    this.itemId = itemId;
    this.warehouseId = warehouseId;
    this.batchId = batchId;
    this.requested = requested;
    this.available = available;
  }
}

interface OnHandBatchRow {
  itemId: string;
  batchId: string | null;
  qty: number;
}

/**
 * Sum the signed deltas in StockLedger grouped by (itemId, batchId) for a set
 * of items. Used by all batch-aware on-hand checks. The returned map is keyed
 * by `${itemId}|${batchId ?? ""}` so callers can look up a specific batch.
 */
async function readOnHandPerBatch(
  tx: Prisma.TransactionClient,
  organizationId: string,
  warehouseId: string,
  itemIds: string[],
): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<OnHandBatchRow[]>`
    SELECT "itemId", "batchId", COALESCE(SUM("qtyDelta"), 0)::float8 AS qty
    FROM "StockLedger"
    WHERE "organizationId" = ${organizationId}
      AND "warehouseId"    = ${warehouseId}
      AND "itemId" IN (${Prisma.join(itemIds)})
    GROUP BY "itemId", "batchId"
  `;
  const out = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.itemId}|${r.batchId ?? ""}`;
    out.set(key, Number(r.qty));
  }
  return out;
}

function batchKey(itemId: string, batchId: string | null | undefined): string {
  return `${itemId}|${batchId ?? ""}`;
}

/**
 * Coalesce duplicate (itemId, batchId) lines (sum qty) so we lock + validate
 * per (item, batch) once. Lines with different batchIds for the same item
 * stay separate — different batches are different stock pools.
 */
function collapseLines<T extends { itemId: string; batchId?: string | null; qty: number }>(
  lines: T[],
): T[] {
  const map = new Map<string, T>();
  for (const line of lines) {
    const key = batchKey(line.itemId, line.batchId ?? null);
    const existing = map.get(key);
    if (existing) {
      existing.qty += line.qty;
    } else {
      map.set(key, { ...line });
    }
  }
  return Array.from(map.values());
}

export async function postGoodsReceipt(input: PostReceiptInput): Promise<{ id: string; docNo: string }> {
  if (input.lines.length === 0) throw new Error("EMPTY_LINES");
  for (const line of input.lines) {
    if (!(line.qty > 0)) throw new Error("INVALID_QTY");
  }

  return prisma.$transaction(async (tx) => {
    const docNo = await issueDocumentNumber({
      tx,
      organizationId: input.organizationId,
      docType: "GOODS_RECEIPT",
      orgCode: input.orgSlug,
      now: input.occurredAt,
    });

    const header = await tx.goodsReceipt.create({
      data: {
        organizationId: input.organizationId,
        docNo,
        occurredAt: input.occurredAt ?? new Date(),
        warehouseId: input.warehouseId,
        supplierId: input.supplierId ?? null,
        note: input.note ?? null,
        createdById: input.createdById,
        lines: {
          create: input.lines.map((l) => ({
            itemId: l.itemId,
            batchId: l.batchId ?? null,
            qty: new Prisma.Decimal(l.qty),
            note: l.note ?? null,
          })),
        },
      },
    });

    await tx.stockLedger.createMany({
      data: input.lines.map((l) => ({
        organizationId: input.organizationId,
        occurredAt: input.occurredAt ?? new Date(),
        itemId: l.itemId,
        batchId: l.batchId ?? null,
        warehouseId: input.warehouseId,
        qtyDelta: new Prisma.Decimal(l.qty),
        moveType: "RECEIPT",
        refType: "GoodsReceipt",
        refId: header.id,
        note: l.note ?? null,
        createdById: input.createdById,
      })),
    });

    return { id: header.id, docNo };
  });
}

export async function postGoodsIssue(input: PostIssueInput): Promise<{ id: string; docNo: string }> {
  if (input.lines.length === 0) throw new Error("EMPTY_LINES");
  for (const line of input.lines) {
    if (!(line.qty > 0)) throw new Error("INVALID_QTY");
  }
  const collapsed = collapseLines(input.lines);

  return prisma.$transaction(async (tx) => {
    // Lock the affected ledger rows so concurrent issues can't both pass the
    // "enough stock" check and then double-spend. Postgres only locks
    // existing rows; if none exist for a (warehouse,item) pair, on-hand is
    // implicitly zero so the validation still rejects correctly.
    const itemIds = Array.from(new Set(collapsed.map((l) => l.itemId)));
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${input.organizationId}
        AND "warehouseId"    = ${input.warehouseId}
        AND "itemId" IN (${Prisma.join(itemIds)})
      FOR UPDATE
    `;

    // Per-batch on-hand lookup: for batch-tracked items the relevant pool is
    // (item, batch); for non-batch items batchId is null on every line and
    // the lookup falls back to the (item, NULL) pool.
    const onHandPerBatch = await readOnHandPerBatch(
      tx,
      input.organizationId,
      input.warehouseId,
      itemIds,
    );
    for (const line of collapsed) {
      const key = batchKey(line.itemId, line.batchId ?? null);
      const available = onHandPerBatch.get(key) ?? 0;
      if (line.qty > available) {
        throw new InsufficientStockError(
          line.itemId,
          input.warehouseId,
          line.qty,
          available,
          line.batchId ?? null,
        );
      }
    }

    const docNo = await issueDocumentNumber({
      tx,
      organizationId: input.organizationId,
      docType: "GOODS_ISSUE",
      orgCode: input.orgSlug,
      now: input.occurredAt,
    });

    const header = await tx.goodsIssue.create({
      data: {
        organizationId: input.organizationId,
        docNo,
        occurredAt: input.occurredAt ?? new Date(),
        warehouseId: input.warehouseId,
        customerId: input.customerId ?? null,
        note: input.note ?? null,
        createdById: input.createdById,
        lines: {
          create: input.lines.map((l) => ({
            itemId: l.itemId,
            batchId: l.batchId ?? null,
            qty: new Prisma.Decimal(l.qty),
            note: l.note ?? null,
          })),
        },
      },
    });

    await tx.stockLedger.createMany({
      data: input.lines.map((l) => ({
        organizationId: input.organizationId,
        occurredAt: input.occurredAt ?? new Date(),
        itemId: l.itemId,
        batchId: l.batchId ?? null,
        warehouseId: input.warehouseId,
        qtyDelta: new Prisma.Decimal(-l.qty),
        moveType: "ISSUE",
        refType: "GoodsIssue",
        refId: header.id,
        note: l.note ?? null,
        createdById: input.createdById,
      })),
    });

    return { id: header.id, docNo };
  });
}

export async function postStockAdjustment(
  input: PostAdjustmentInput,
): Promise<{ id: string; docNo: string }> {
  if (input.lines.length === 0) throw new Error("EMPTY_LINES");
  for (const line of input.lines) {
    if (!(line.qty > 0)) throw new Error("INVALID_QTY");
  }

  // Treat each line as +qty or -qty so the rest of the logic looks like issue + receipt.
  const signed = input.lines.map((l) => ({
    itemId: l.itemId,
    batchId: l.batchId ?? null,
    delta: l.direction === "IN" ? l.qty : -l.qty,
    direction: l.direction,
    qty: l.qty,
    note: l.note,
  }));
  const decreasingItemIds = Array.from(
    new Set(signed.filter((l) => l.delta < 0).map((l) => l.itemId)),
  );

  return prisma.$transaction(async (tx) => {
    if (decreasingItemIds.length > 0) {
      await tx.$executeRaw`
        SELECT id FROM "StockLedger"
        WHERE "organizationId" = ${input.organizationId}
          AND "warehouseId"    = ${input.warehouseId}
          AND "itemId" IN (${Prisma.join(decreasingItemIds)})
        FOR UPDATE
      `;
      const onHandPerBatch = await readOnHandPerBatch(
        tx,
        input.organizationId,
        input.warehouseId,
        decreasingItemIds,
      );

      // Net out the deltas per (item, batch) (a single adjustment can have IN
      // and OUT lines for the same item or batch) before comparing against
      // current on-hand.
      const netDelta = new Map<string, { itemId: string; batchId: string | null; delta: number }>();
      for (const s of signed) {
        const key = batchKey(s.itemId, s.batchId);
        const existing = netDelta.get(key);
        if (existing) {
          existing.delta += s.delta;
        } else {
          netDelta.set(key, { itemId: s.itemId, batchId: s.batchId, delta: s.delta });
        }
      }
      for (const [key, n] of netDelta) {
        if (n.delta < 0) {
          const available = onHandPerBatch.get(key) ?? 0;
          if (Math.abs(n.delta) > available) {
            throw new InsufficientStockError(
              n.itemId,
              input.warehouseId,
              Math.abs(n.delta),
              available,
              n.batchId,
            );
          }
        }
      }
    }

    const docNo = await issueDocumentNumber({
      tx,
      organizationId: input.organizationId,
      docType: "STOCK_ADJUSTMENT",
      orgCode: input.orgSlug,
      now: input.occurredAt,
    });

    const header = await tx.stockAdjustment.create({
      data: {
        organizationId: input.organizationId,
        docNo,
        occurredAt: input.occurredAt ?? new Date(),
        warehouseId: input.warehouseId,
        reason: input.reason ?? null,
        createdById: input.createdById,
        lines: {
          create: input.lines.map((l) => ({
            itemId: l.itemId,
            batchId: l.batchId ?? null,
            direction: l.direction,
            qty: new Prisma.Decimal(l.qty),
            note: l.note ?? null,
          })),
        },
      },
    });

    await tx.stockLedger.createMany({
      data: signed.map((s) => ({
        organizationId: input.organizationId,
        occurredAt: input.occurredAt ?? new Date(),
        itemId: s.itemId,
        batchId: s.batchId,
        warehouseId: input.warehouseId,
        qtyDelta: new Prisma.Decimal(s.delta),
        moveType: s.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        refType: "StockAdjustment",
        refId: header.id,
        note: s.note ?? null,
        createdById: input.createdById,
      })),
    });

    return { id: header.id, docNo };
  });
}

export class SameWarehouseTransferError extends Error {
  constructor() {
    super("Transfer source and destination must be different warehouses");
    this.name = "SameWarehouseTransferError";
  }
}

export async function postStockTransfer(
  input: PostTransferInput,
): Promise<{ id: string; docNo: string }> {
  if (input.lines.length === 0) throw new Error("EMPTY_LINES");
  for (const line of input.lines) {
    if (!(line.qty > 0)) throw new Error("INVALID_QTY");
  }
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new SameWarehouseTransferError();
  }
  const collapsed = collapseLines(input.lines);

  return prisma.$transaction(async (tx) => {
    // Lock source ledger rows so concurrent issues/transfers can't both pass
    // the on-hand check. Destination doesn't need locking because we're only
    // adding stock there.
    const itemIds = Array.from(new Set(collapsed.map((l) => l.itemId)));
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${input.organizationId}
        AND "warehouseId"    = ${input.fromWarehouseId}
        AND "itemId" IN (${Prisma.join(itemIds)})
      FOR UPDATE
    `;

    const onHandPerBatch = await readOnHandPerBatch(
      tx,
      input.organizationId,
      input.fromWarehouseId,
      itemIds,
    );
    for (const line of collapsed) {
      const key = batchKey(line.itemId, line.batchId ?? null);
      const available = onHandPerBatch.get(key) ?? 0;
      if (line.qty > available) {
        throw new InsufficientStockError(
          line.itemId,
          input.fromWarehouseId,
          line.qty,
          available,
          line.batchId ?? null,
        );
      }
    }

    const docNo = await issueDocumentNumber({
      tx,
      organizationId: input.organizationId,
      docType: "STOCK_TRANSFER",
      orgCode: input.orgSlug,
      now: input.occurredAt,
    });

    const header = await tx.stockTransfer.create({
      data: {
        organizationId: input.organizationId,
        docNo,
        occurredAt: input.occurredAt ?? new Date(),
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        note: input.note ?? null,
        createdById: input.createdById,
        lines: {
          create: input.lines.map((l) => ({
            itemId: l.itemId,
            batchId: l.batchId ?? null,
            qty: new Prisma.Decimal(l.qty),
            note: l.note ?? null,
          })),
        },
      },
    });

    // Two ledger entries per line: OUT at source, IN at destination, with the
    // same occurredAt + refId so they can always be paired. Batch identity is
    // preserved across warehouses.
    const occurredAt = input.occurredAt ?? new Date();
    const ledgerRows = input.lines.flatMap((l) => [
      {
        organizationId: input.organizationId,
        occurredAt,
        itemId: l.itemId,
        batchId: l.batchId ?? null,
        warehouseId: input.fromWarehouseId,
        qtyDelta: new Prisma.Decimal(-l.qty),
        moveType: "TRANSFER_OUT" as const,
        refType: "StockTransfer",
        refId: header.id,
        note: l.note ?? null,
        createdById: input.createdById,
      },
      {
        organizationId: input.organizationId,
        occurredAt,
        itemId: l.itemId,
        batchId: l.batchId ?? null,
        warehouseId: input.toWarehouseId,
        qtyDelta: new Prisma.Decimal(l.qty),
        moveType: "TRANSFER_IN" as const,
        refType: "StockTransfer",
        refId: header.id,
        note: l.note ?? null,
        createdById: input.createdById,
      },
    ]);
    await tx.stockLedger.createMany({ data: ledgerRows });

    return { id: header.id, docNo };
  });
}

// --- Cancellation -------------------------------------------------------
//
// Cancelling a posted transaction writes reversal ledger entries (opposite
// sign) tied to the original header. The header is then flipped to CANCELED.
// We never UPDATE or DELETE rows in StockLedger -- this keeps the audit trail
// intact and means on-hand computations remain a single SUM.

interface CancelOpts {
  organizationId: string;
  canceledById: string;
  reason?: string;
}

export async function cancelGoodsReceipt(id: string, opts: CancelOpts): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.goodsReceipt.findFirst({
      where: { id, organizationId: opts.organizationId },
      include: { lines: true },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "POSTED") throw new Error("ALREADY_CANCELED");

    await tx.goodsReceipt.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledById: opts.canceledById,
        cancelReason: opts.reason ?? null,
      },
    });

    // Before reversing, make sure cancelling doesn't drive on-hand negative
    // somewhere else (i.e. the goods were already issued out). We sum on-hand
    // per (item, batch) in the receipt's warehouse with locks.
    const itemIds = Array.from(new Set(header.lines.map((l) => l.itemId)));
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${opts.organizationId}
        AND "warehouseId"    = ${header.warehouseId}
        AND "itemId" IN (${Prisma.join(itemIds)})
      FOR UPDATE
    `;
    const onHandPerBatch = await readOnHandPerBatch(
      tx,
      opts.organizationId,
      header.warehouseId,
      itemIds,
    );
    // Net the per-(item, batch) reversal so multiple lines for the same
    // (item, batch) are only checked against on-hand once.
    const netRev = new Map<string, { itemId: string; batchId: string | null; qty: number }>();
    for (const l of header.lines) {
      const key = batchKey(l.itemId, l.batchId);
      const existing = netRev.get(key);
      const qty = Number(l.qty);
      if (existing) {
        existing.qty += qty;
      } else {
        netRev.set(key, { itemId: l.itemId, batchId: l.batchId, qty });
      }
    }
    for (const [key, n] of netRev) {
      const available = onHandPerBatch.get(key) ?? 0;
      if (n.qty > available) {
        throw new InsufficientStockError(
          n.itemId,
          header.warehouseId,
          n.qty,
          available,
          n.batchId,
        );
      }
    }

    await tx.stockLedger.createMany({
      data: header.lines.map((l) => ({
        organizationId: opts.organizationId,
        occurredAt: new Date(),
        itemId: l.itemId,
        batchId: l.batchId,
        warehouseId: header.warehouseId,
        qtyDelta: new Prisma.Decimal(Number(l.qty) * -1),
        moveType: "RECEIPT_REVERSAL",
        refType: "GoodsReceipt",
        refId: header.id,
        note: opts.reason ?? null,
        createdById: opts.canceledById,
      })),
    });
  });
}

export async function cancelGoodsIssue(id: string, opts: CancelOpts): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.goodsIssue.findFirst({
      where: { id, organizationId: opts.organizationId },
      include: { lines: true },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "POSTED") throw new Error("ALREADY_CANCELED");

    await tx.goodsIssue.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledById: opts.canceledById,
        cancelReason: opts.reason ?? null,
      },
    });

    // Reversing an issue adds stock back -- always safe wrt non-negativity.
    await tx.stockLedger.createMany({
      data: header.lines.map((l) => ({
        organizationId: opts.organizationId,
        occurredAt: new Date(),
        itemId: l.itemId,
        batchId: l.batchId,
        warehouseId: header.warehouseId,
        qtyDelta: new Prisma.Decimal(Number(l.qty)),
        moveType: "ISSUE_REVERSAL",
        refType: "GoodsIssue",
        refId: header.id,
        note: opts.reason ?? null,
        createdById: opts.canceledById,
      })),
    });
  });
}

export async function cancelStockAdjustment(id: string, opts: CancelOpts): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.stockAdjustment.findFirst({
      where: { id, organizationId: opts.organizationId },
      include: { lines: true },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "POSTED") throw new Error("ALREADY_CANCELED");

    await tx.stockAdjustment.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledById: opts.canceledById,
        cancelReason: opts.reason ?? null,
      },
    });

    // Reversing an IN line subtracts stock -- could go negative if it has been
    // issued. Reversing an OUT line adds stock -- always safe.
    const reversals = header.lines.map((l) => ({
      itemId: l.itemId,
      batchId: l.batchId,
      delta:
        l.direction === "IN" ? -Number(l.qty) : Number(l.qty),
    }));
    const decreasingItemIds = Array.from(
      new Set(reversals.filter((r) => r.delta < 0).map((r) => r.itemId)),
    );
    if (decreasingItemIds.length > 0) {
      await tx.$executeRaw`
        SELECT id FROM "StockLedger"
        WHERE "organizationId" = ${opts.organizationId}
          AND "warehouseId"    = ${header.warehouseId}
          AND "itemId" IN (${Prisma.join(decreasingItemIds)})
        FOR UPDATE
      `;
      const onHandPerBatch = await readOnHandPerBatch(
        tx,
        opts.organizationId,
        header.warehouseId,
        decreasingItemIds,
      );
      const netDelta = new Map<string, { itemId: string; batchId: string | null; delta: number }>();
      for (const r of reversals) {
        const key = batchKey(r.itemId, r.batchId);
        const existing = netDelta.get(key);
        if (existing) {
          existing.delta += r.delta;
        } else {
          netDelta.set(key, { itemId: r.itemId, batchId: r.batchId, delta: r.delta });
        }
      }
      for (const [key, n] of netDelta) {
        if (n.delta < 0) {
          const available = onHandPerBatch.get(key) ?? 0;
          if (Math.abs(n.delta) > available) {
            throw new InsufficientStockError(
              n.itemId,
              header.warehouseId,
              Math.abs(n.delta),
              available,
              n.batchId,
            );
          }
        }
      }
    }

    await tx.stockLedger.createMany({
      data: header.lines.map((l) => ({
        organizationId: opts.organizationId,
        occurredAt: new Date(),
        itemId: l.itemId,
        batchId: l.batchId,
        warehouseId: header.warehouseId,
        qtyDelta: new Prisma.Decimal(
          l.direction === "IN" ? -Number(l.qty) : Number(l.qty),
        ),
        moveType: "ADJUSTMENT_REVERSAL",
        refType: "StockAdjustment",
        refId: header.id,
        note: opts.reason ?? null,
        createdById: opts.canceledById,
      })),
    });
  });
}

export async function cancelStockTransfer(id: string, opts: CancelOpts): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.stockTransfer.findFirst({
      where: { id, organizationId: opts.organizationId },
      include: { lines: true },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "POSTED") throw new Error("ALREADY_CANCELED");

    // Reversing a transfer adds stock back to the source and removes it from
    // the destination -- the destination removal could drive on-hand negative
    // if the receiver already issued the goods. Lock & validate destination
    // per (item, batch).
    const itemIds = Array.from(new Set(header.lines.map((l) => l.itemId)));
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${opts.organizationId}
        AND "warehouseId"    = ${header.toWarehouseId}
        AND "itemId" IN (${Prisma.join(itemIds)})
      FOR UPDATE
    `;
    const destOnHandPerBatch = await readOnHandPerBatch(
      tx,
      opts.organizationId,
      header.toWarehouseId,
      itemIds,
    );
    const collapsedRev = new Map<string, { itemId: string; batchId: string | null; qty: number }>();
    for (const l of header.lines) {
      const key = batchKey(l.itemId, l.batchId);
      const existing = collapsedRev.get(key);
      const qty = Number(l.qty);
      if (existing) {
        existing.qty += qty;
      } else {
        collapsedRev.set(key, { itemId: l.itemId, batchId: l.batchId, qty });
      }
    }
    for (const [key, n] of collapsedRev) {
      const available = destOnHandPerBatch.get(key) ?? 0;
      if (n.qty > available) {
        throw new InsufficientStockError(
          n.itemId,
          header.toWarehouseId,
          n.qty,
          available,
          n.batchId,
        );
      }
    }

    await tx.stockTransfer.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledById: opts.canceledById,
        cancelReason: opts.reason ?? null,
      },
    });

    const occurredAt = new Date();
    const ledgerRows = header.lines.flatMap((l) => [
      {
        organizationId: opts.organizationId,
        occurredAt,
        itemId: l.itemId,
        batchId: l.batchId,
        warehouseId: header.fromWarehouseId,
        qtyDelta: new Prisma.Decimal(Number(l.qty)),
        moveType: "TRANSFER_REVERSAL" as const,
        refType: "StockTransfer",
        refId: header.id,
        note: opts.reason ?? null,
        createdById: opts.canceledById,
      },
      {
        organizationId: opts.organizationId,
        occurredAt,
        itemId: l.itemId,
        batchId: l.batchId,
        warehouseId: header.toWarehouseId,
        qtyDelta: new Prisma.Decimal(-Number(l.qty)),
        moveType: "TRANSFER_REVERSAL" as const,
        refType: "StockTransfer",
        refId: header.id,
        note: opts.reason ?? null,
        createdById: opts.canceledById,
      },
    ]);
    await tx.stockLedger.createMany({ data: ledgerRows });
  });
}

// --- Stock Opname -------------------------------------------------------
//
// Opnames are physical stock counts. Creating a draft snapshots the current
// on-hand for every active item in the chosen warehouse (systemQty). The
// operator then fills in countedQty per line. Posting writes one ledger
// entry per line whose final on-hand differs from the count -- so concurrent
// transactions between snapshot and post are honoured (the count becomes
// the authoritative on-hand, not "snapshot + variance").

export interface CreateOpnameDraftInput {
  organizationId: string;
  orgSlug: string;
  createdById: string;
  warehouseId: string;
  occurredAt?: Date;
  note?: string;
}

export async function createOpnameDraft(
  input: CreateOpnameDraftInput,
): Promise<{ id: string; docNo: string; lineCount: number }> {
  return prisma.$transaction(async (tx) => {
    // Snapshot every active item in the org. We snapshot the full catalog (not
    // just items with non-zero stock) so the operator can record findings for
    // items the system thinks are at zero too.
    const items = await tx.item.findMany({
      where: { organizationId: input.organizationId, isActive: true },
      select: { id: true, tracksBatch: true },
      orderBy: { sku: "asc" },
    });

    // For batch-tracked items, get the per-batch on-hand. For non-batch items
    // we still group by batchId (which is null) so the same query covers both.
    const onHandRaw = await tx.$queryRaw<Array<{ itemId: string; batchId: string | null; qty: string }>>`
      SELECT "itemId", "batchId", COALESCE(SUM("qtyDelta"), 0)::text AS qty
      FROM "StockLedger"
      WHERE "organizationId" = ${input.organizationId}
        AND "warehouseId"    = ${input.warehouseId}
      GROUP BY "itemId", "batchId"
    `;
    // Map keyed by `${itemId}|${batchId ?? ""}`.
    const onHandPerBatch = new Map<string, string>();
    // Aggregate per-item totals for non-batch items (where batchId is null).
    for (const r of onHandRaw) {
      onHandPerBatch.set(`${r.itemId}|${r.batchId ?? ""}`, r.qty);
    }

    // For batch-tracked items, also pull every active batch known for the
    // item so the count covers batches that don't yet have ledger rows in
    // this warehouse (systemQty = 0 — "system thinks empty, count anyway").
    const trackedItemIds = items.filter((i) => i.tracksBatch).map((i) => i.id);
    const batches =
      trackedItemIds.length === 0
        ? []
        : await tx.itemBatch.findMany({
            where: {
              organizationId: input.organizationId,
              itemId: { in: trackedItemIds },
              isActive: true,
            },
            select: { id: true, itemId: true, expiryDate: true },
            orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
          });
    const batchesByItem = new Map<string, Array<{ id: string }>>();
    for (const b of batches) {
      const list = batchesByItem.get(b.itemId) ?? [];
      list.push({ id: b.id });
      batchesByItem.set(b.itemId, list);
    }

    const docNo = await issueDocumentNumber({
      tx,
      organizationId: input.organizationId,
      docType: "STOCK_OPNAME",
      orgCode: input.orgSlug,
      now: input.occurredAt,
    });

    // Build the line list. Non-batch items get a single line with batchId
    // null. Batch items get one line per known batch — plus, defensively,
    // any (item, batch) combination that already shows up in the ledger but
    // isn't on the active-batch list yet (so historical batches still show).
    type LineDraft = { itemId: string; batchId: string | null; systemQty: Prisma.Decimal };
    const lineDrafts: LineDraft[] = [];
    for (const item of items) {
      if (!item.tracksBatch) {
        const qty = new Prisma.Decimal(onHandPerBatch.get(`${item.id}|`) ?? "0");
        lineDrafts.push({ itemId: item.id, batchId: null, systemQty: qty });
        continue;
      }
      const knownBatches = batchesByItem.get(item.id) ?? [];
      const seenBatchIds = new Set(knownBatches.map((b) => b.id));
      // Pull any (item, batch) rows from the ledger map for this item.
      for (const r of onHandRaw) {
        if (r.itemId === item.id && r.batchId && !seenBatchIds.has(r.batchId)) {
          knownBatches.push({ id: r.batchId });
          seenBatchIds.add(r.batchId);
        }
      }
      if (knownBatches.length === 0) {
        // No batches yet — leave the item out of the count rather than insert
        // a meaningless batchId-null line for a tracked item.
        continue;
      }
      for (const b of knownBatches) {
        const qty = new Prisma.Decimal(onHandPerBatch.get(`${item.id}|${b.id}`) ?? "0");
        lineDrafts.push({ itemId: item.id, batchId: b.id, systemQty: qty });
      }
    }

    const header = await tx.stockOpname.create({
      data: {
        organizationId: input.organizationId,
        docNo,
        occurredAt: input.occurredAt ?? new Date(),
        warehouseId: input.warehouseId,
        note: input.note ?? null,
        status: "DRAFT",
        createdById: input.createdById,
        lines: {
          create: lineDrafts.map((d) => ({
            itemId: d.itemId,
            batchId: d.batchId,
            systemQty: d.systemQty,
            countedQty: d.systemQty,
            varianceQty: new Prisma.Decimal(0),
          })),
        },
      },
    });

    return { id: header.id, docNo, lineCount: lineDrafts.length };
  });
}

export interface UpdateOpnameLineInput {
  organizationId: string;
  opnameId: string;
  // Identify the line either by id (when the UI knows it) or by
  // (itemId, batchId) for the legacy code path. lineId wins if set.
  lineId?: string;
  itemId?: string;
  batchId?: string | null;
  countedQty: number;
  note?: string | null;
}

export async function updateOpnameLine(input: UpdateOpnameLineInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.stockOpname.findFirst({
      where: { id: input.opnameId, organizationId: input.organizationId },
      select: { status: true },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "DRAFT") throw new Error("NOT_DRAFT");

    const line = input.lineId
      ? await tx.stockOpnameLine.findFirst({
          where: { id: input.lineId, opnameId: input.opnameId },
          select: { id: true, systemQty: true },
        })
      : await tx.stockOpnameLine.findFirst({
          where: {
            opnameId: input.opnameId,
            itemId: input.itemId,
            batchId: input.batchId ?? null,
          },
          select: { id: true, systemQty: true },
        });
    if (!line) throw new Error("LINE_NOT_FOUND");

    const counted = new Prisma.Decimal(input.countedQty);
    const variance = counted.minus(line.systemQty);

    await tx.stockOpnameLine.update({
      where: { id: line.id },
      data: {
        countedQty: counted,
        varianceQty: variance,
        note: input.note ?? null,
      },
    });
  });
}

export interface PostOpnameInput {
  organizationId: string;
  opnameId: string;
  postedById: string;
}

export async function postOpname(input: PostOpnameInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.stockOpname.findFirst({
      where: { id: input.opnameId, organizationId: input.organizationId },
      include: { lines: { select: { itemId: true, batchId: true, countedQty: true } } },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "DRAFT") throw new Error("NOT_DRAFT");

    // Re-read the current on-hand inside the transaction so concurrent
    // mutations between snapshot and post don't make us write the wrong
    // delta. We treat countedQty as authoritative -- the resulting on-hand
    // after posting is exactly countedQty for each (item, batch).
    const itemIds = Array.from(new Set(header.lines.map((l) => l.itemId)));
    if (itemIds.length === 0) {
      await tx.stockOpname.update({
        where: { id: header.id },
        data: {
          status: "POSTED",
          postedAt: new Date(),
          postedById: input.postedById,
        },
      });
      return;
    }

    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${input.organizationId}
        AND "warehouseId"    = ${header.warehouseId}
        AND "itemId" IN (${Prisma.join(itemIds)})
      FOR UPDATE
    `;
    const onHandPerBatch = await readOnHandPerBatch(
      tx,
      input.organizationId,
      header.warehouseId,
      itemIds,
    );

    const occurredAt = new Date();
    const rows: Prisma.StockLedgerCreateManyInput[] = [];
    for (const line of header.lines) {
      const key = batchKey(line.itemId, line.batchId);
      const current = onHandPerBatch.get(key) ?? 0;
      const target = Number(line.countedQty);
      const delta = target - current;
      if (delta === 0) continue;
      rows.push({
        organizationId: input.organizationId,
        occurredAt,
        itemId: line.itemId,
        batchId: line.batchId,
        warehouseId: header.warehouseId,
        qtyDelta: new Prisma.Decimal(delta),
        moveType: delta > 0 ? "OPNAME_IN" : "OPNAME_OUT",
        refType: "StockOpname",
        refId: header.id,
        note: null,
        createdById: input.postedById,
      });
    }
    if (rows.length > 0) {
      await tx.stockLedger.createMany({ data: rows });
    }

    await tx.stockOpname.update({
      where: { id: header.id },
      data: {
        status: "POSTED",
        postedAt: occurredAt,
        postedById: input.postedById,
      },
    });
  });
}

export async function cancelOpnameDraft(
  id: string,
  opts: { organizationId: string; canceledById: string; reason?: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.stockOpname.findFirst({
      where: { id, organizationId: opts.organizationId },
      select: { status: true },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "DRAFT") throw new Error("NOT_DRAFT");

    await tx.stockOpname.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledById: opts.canceledById,
        cancelReason: opts.reason ?? null,
      },
    });
  });
}

export async function cancelPostedOpname(
  id: string,
  opts: { organizationId: string; canceledById: string; reason?: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const header = await tx.stockOpname.findFirst({
      where: { id, organizationId: opts.organizationId },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "POSTED") throw new Error("NOT_POSTED");

    // Find the ledger entries this opname produced and reverse them.
    const entries = await tx.stockLedger.findMany({
      where: {
        organizationId: opts.organizationId,
        refType: "StockOpname",
        refId: id,
        moveType: { in: ["OPNAME_IN", "OPNAME_OUT"] },
      },
      select: { itemId: true, batchId: true, qtyDelta: true },
    });

    if (entries.length > 0) {
      const itemIds = Array.from(new Set(entries.map((e) => e.itemId)));
      await tx.$executeRaw`
        SELECT id FROM "StockLedger"
        WHERE "organizationId" = ${opts.organizationId}
          AND "warehouseId"    = ${header.warehouseId}
          AND "itemId" IN (${Prisma.join(itemIds)})
        FOR UPDATE
      `;

      // Validate that reversing won't drive on-hand negative. Net the
      // per-(item, batch) reversal deltas first.
      const netRev = new Map<string, { itemId: string; batchId: string | null; rev: number }>();
      for (const e of entries) {
        const key = batchKey(e.itemId, e.batchId);
        const rev = -Number(e.qtyDelta);
        const existing = netRev.get(key);
        if (existing) {
          existing.rev += rev;
        } else {
          netRev.set(key, { itemId: e.itemId, batchId: e.batchId, rev });
        }
      }
      const onHandPerBatch = await readOnHandPerBatch(
        tx,
        opts.organizationId,
        header.warehouseId,
        itemIds,
      );
      for (const [key, n] of netRev) {
        const available = onHandPerBatch.get(key) ?? 0;
        if (available + n.rev < 0) {
          throw new InsufficientStockError(
            n.itemId,
            header.warehouseId,
            Math.abs(n.rev),
            available,
            n.batchId,
          );
        }
      }

      const occurredAt = new Date();
      await tx.stockLedger.createMany({
        data: entries.map((e) => ({
          organizationId: opts.organizationId,
          occurredAt,
          itemId: e.itemId,
          batchId: e.batchId,
          warehouseId: header.warehouseId,
          qtyDelta: new Prisma.Decimal(-Number(e.qtyDelta)),
          moveType: "OPNAME_REVERSAL" as const,
          refType: "StockOpname",
          refId: id,
          note: opts.reason ?? null,
          createdById: opts.canceledById,
        })),
      });
    }

    await tx.stockOpname.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledById: opts.canceledById,
        cancelReason: opts.reason ?? null,
      },
    });
  });
}

// --- Read helpers -------------------------------------------------------

export interface StockOnHand {
  itemId: string;
  warehouseId: string;
  qty: number;
}

export async function getStockOnHand(
  organizationId: string,
  filter?: { warehouseId?: string; itemId?: string },
): Promise<StockOnHand[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`"organizationId" = ${organizationId}`];
  if (filter?.warehouseId) {
    conditions.push(Prisma.sql`"warehouseId" = ${filter.warehouseId}`);
  }
  if (filter?.itemId) {
    conditions.push(Prisma.sql`"itemId" = ${filter.itemId}`);
  }
  const whereSql = Prisma.join(conditions, " AND ");

  return prisma.$queryRaw<StockOnHand[]>`
    SELECT "itemId", "warehouseId", COALESCE(SUM("qtyDelta"), 0)::float8 AS qty
    FROM "StockLedger"
    WHERE ${whereSql}
    GROUP BY "itemId", "warehouseId"
    HAVING COALESCE(SUM("qtyDelta"), 0) <> 0
  `;
}

export interface StockOnHandWithBatch {
  itemId: string;
  warehouseId: string;
  batchId: string | null;
  qty: number;
}

/**
 * Per-batch on-hand. For non-batch items batchId is null and the row
 * aggregates the (item, warehouse, NULL) pool.
 */
export async function getStockOnHandPerBatch(
  organizationId: string,
  filter?: { warehouseId?: string; itemId?: string; batchId?: string | null },
): Promise<StockOnHandWithBatch[]> {
  const conditions: Prisma.Sql[] = [Prisma.sql`"organizationId" = ${organizationId}`];
  if (filter?.warehouseId) {
    conditions.push(Prisma.sql`"warehouseId" = ${filter.warehouseId}`);
  }
  if (filter?.itemId) {
    conditions.push(Prisma.sql`"itemId" = ${filter.itemId}`);
  }
  if (filter && "batchId" in filter) {
    if (filter.batchId === null) {
      conditions.push(Prisma.sql`"batchId" IS NULL`);
    } else if (filter.batchId !== undefined) {
      conditions.push(Prisma.sql`"batchId" = ${filter.batchId}`);
    }
  }
  const whereSql = Prisma.join(conditions, " AND ");

  return prisma.$queryRaw<StockOnHandWithBatch[]>`
    SELECT "itemId", "warehouseId", "batchId", COALESCE(SUM("qtyDelta"), 0)::float8 AS qty
    FROM "StockLedger"
    WHERE ${whereSql}
    GROUP BY "itemId", "warehouseId", "batchId"
    HAVING COALESCE(SUM("qtyDelta"), 0) <> 0
  `;
}
