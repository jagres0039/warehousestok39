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
  qty: number;
  note?: string;
}

export interface IssueLineInput {
  itemId: string;
  qty: number;
  note?: string;
}

export interface AdjustmentLineInput {
  itemId: string;
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

export class InsufficientStockError extends Error {
  itemId: string;
  warehouseId: string;
  requested: number;
  available: number;
  constructor(itemId: string, warehouseId: string, requested: number, available: number) {
    super(`Insufficient stock for item ${itemId} in warehouse ${warehouseId}`);
    this.name = "InsufficientStockError";
    this.itemId = itemId;
    this.warehouseId = warehouseId;
    this.requested = requested;
    this.available = available;
  }
}

interface OnHandRow {
  itemId: string;
  qty: number;
}

/** Sum the signed deltas in StockLedger for a set of items in one warehouse. */
async function readOnHand(
  tx: Prisma.TransactionClient,
  organizationId: string,
  warehouseId: string,
  itemIds: string[],
): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<OnHandRow[]>`
    SELECT "itemId", COALESCE(SUM("qtyDelta"), 0)::float8 AS qty
    FROM "StockLedger"
    WHERE "organizationId" = ${organizationId}
      AND "warehouseId"    = ${warehouseId}
      AND "itemId" IN (${Prisma.join(itemIds)})
    GROUP BY "itemId"
  `;
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.itemId, Number(r.qty));
  return out;
}

/** Coalesce duplicate item lines (sum qty) so we lock + validate per item once. */
function collapseLines<T extends { itemId: string; qty: number }>(lines: T[]): T[] {
  const map = new Map<string, T>();
  for (const line of lines) {
    const existing = map.get(line.itemId);
    if (existing) {
      existing.qty += line.qty;
    } else {
      map.set(line.itemId, { ...line });
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
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${input.organizationId}
        AND "warehouseId"    = ${input.warehouseId}
        AND "itemId" IN (${Prisma.join(collapsed.map((l) => l.itemId))})
      FOR UPDATE
    `;

    const onHand = await readOnHand(
      tx,
      input.organizationId,
      input.warehouseId,
      collapsed.map((l) => l.itemId),
    );
    for (const line of collapsed) {
      const available = onHand.get(line.itemId) ?? 0;
      if (line.qty > available) {
        throw new InsufficientStockError(line.itemId, input.warehouseId, line.qty, available);
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
    delta: l.direction === "IN" ? l.qty : -l.qty,
    direction: l.direction,
    qty: l.qty,
    note: l.note,
  }));
  const decreasingIds = Array.from(
    new Set(signed.filter((l) => l.delta < 0).map((l) => l.itemId)),
  );

  return prisma.$transaction(async (tx) => {
    if (decreasingIds.length > 0) {
      await tx.$executeRaw`
        SELECT id FROM "StockLedger"
        WHERE "organizationId" = ${input.organizationId}
          AND "warehouseId"    = ${input.warehouseId}
          AND "itemId" IN (${Prisma.join(decreasingIds)})
        FOR UPDATE
      `;
      const onHand = await readOnHand(
        tx,
        input.organizationId,
        input.warehouseId,
        decreasingIds,
      );

      // Net out the decrements per item (a single adjustment can have IN and OUT
      // lines for the same item) before comparing against current on-hand.
      const netDecrease = new Map<string, number>();
      for (const s of signed) {
        if (s.delta < 0) {
          netDecrease.set(s.itemId, (netDecrease.get(s.itemId) ?? 0) + s.delta);
        } else {
          netDecrease.set(s.itemId, (netDecrease.get(s.itemId) ?? 0) + s.delta);
        }
      }
      for (const [itemId, net] of netDecrease) {
        if (net < 0 && Math.abs(net) > (onHand.get(itemId) ?? 0)) {
          throw new InsufficientStockError(itemId, input.warehouseId, Math.abs(net), onHand.get(itemId) ?? 0);
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
    // for each item in the receipt's warehouse with locks.
    const itemIds = Array.from(new Set(header.lines.map((l) => l.itemId)));
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${opts.organizationId}
        AND "warehouseId"    = ${header.warehouseId}
        AND "itemId" IN (${Prisma.join(itemIds)})
      FOR UPDATE
    `;
    const onHand = await readOnHand(tx, opts.organizationId, header.warehouseId, itemIds);
    for (const line of header.lines) {
      const available = onHand.get(line.itemId) ?? 0;
      const qty = Number(line.qty);
      if (qty > available) {
        throw new InsufficientStockError(line.itemId, header.warehouseId, qty, available);
      }
    }

    await tx.stockLedger.createMany({
      data: header.lines.map((l) => ({
        organizationId: opts.organizationId,
        occurredAt: new Date(),
        itemId: l.itemId,
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
      delta:
        l.direction === "IN" ? -Number(l.qty) : Number(l.qty),
    }));
    const decreasingIds = Array.from(
      new Set(reversals.filter((r) => r.delta < 0).map((r) => r.itemId)),
    );
    if (decreasingIds.length > 0) {
      await tx.$executeRaw`
        SELECT id FROM "StockLedger"
        WHERE "organizationId" = ${opts.organizationId}
          AND "warehouseId"    = ${header.warehouseId}
          AND "itemId" IN (${Prisma.join(decreasingIds)})
        FOR UPDATE
      `;
      const onHand = await readOnHand(tx, opts.organizationId, header.warehouseId, decreasingIds);
      const netDelta = new Map<string, number>();
      for (const r of reversals) {
        netDelta.set(r.itemId, (netDelta.get(r.itemId) ?? 0) + r.delta);
      }
      for (const [itemId, net] of netDelta) {
        if (net < 0 && Math.abs(net) > (onHand.get(itemId) ?? 0)) {
          throw new InsufficientStockError(itemId, header.warehouseId, Math.abs(net), onHand.get(itemId) ?? 0);
        }
      }
    }

    await tx.stockLedger.createMany({
      data: header.lines.map((l) => ({
        organizationId: opts.organizationId,
        occurredAt: new Date(),
        itemId: l.itemId,
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
