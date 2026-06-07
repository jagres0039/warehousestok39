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

export interface TransferLineInput {
  itemId: string;
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
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${input.organizationId}
        AND "warehouseId"    = ${input.fromWarehouseId}
        AND "itemId" IN (${Prisma.join(collapsed.map((l) => l.itemId))})
      FOR UPDATE
    `;

    const onHand = await readOnHand(
      tx,
      input.organizationId,
      input.fromWarehouseId,
      collapsed.map((l) => l.itemId),
    );
    for (const line of collapsed) {
      const available = onHand.get(line.itemId) ?? 0;
      if (line.qty > available) {
        throw new InsufficientStockError(
          line.itemId,
          input.fromWarehouseId,
          line.qty,
          available,
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
            qty: new Prisma.Decimal(l.qty),
            note: l.note ?? null,
          })),
        },
      },
    });

    // Two ledger entries per line: OUT at source, IN at destination, with the
    // same occurredAt + refId so they can always be paired.
    const occurredAt = input.occurredAt ?? new Date();
    const ledgerRows = input.lines.flatMap((l) => [
      {
        organizationId: input.organizationId,
        occurredAt,
        itemId: l.itemId,
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
    // if the receiver already issued the goods. Lock & validate destination.
    const itemIds = Array.from(new Set(header.lines.map((l) => l.itemId)));
    await tx.$executeRaw`
      SELECT id FROM "StockLedger"
      WHERE "organizationId" = ${opts.organizationId}
        AND "warehouseId"    = ${header.toWarehouseId}
        AND "itemId" IN (${Prisma.join(itemIds)})
      FOR UPDATE
    `;
    const destOnHand = await readOnHand(
      tx,
      opts.organizationId,
      header.toWarehouseId,
      itemIds,
    );
    const collapsedRev = new Map<string, number>();
    for (const l of header.lines) {
      collapsedRev.set(l.itemId, (collapsedRev.get(l.itemId) ?? 0) + Number(l.qty));
    }
    for (const [itemId, qty] of collapsedRev) {
      const available = destOnHand.get(itemId) ?? 0;
      if (qty > available) {
        throw new InsufficientStockError(
          itemId,
          header.toWarehouseId,
          qty,
          available,
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
      select: { id: true },
      orderBy: { sku: "asc" },
    });

    const onHandRaw = await tx.$queryRaw<Array<{ itemId: string; qty: string }>>`
      SELECT "itemId", COALESCE(SUM("qtyDelta"), 0)::text AS qty
      FROM "StockLedger"
      WHERE "organizationId" = ${input.organizationId}
        AND "warehouseId"    = ${input.warehouseId}
      GROUP BY "itemId"
    `;
    const onHand = new Map(onHandRaw.map((r) => [r.itemId, r.qty]));

    const docNo = await issueDocumentNumber({
      tx,
      organizationId: input.organizationId,
      docType: "STOCK_OPNAME",
      orgCode: input.orgSlug,
      now: input.occurredAt,
    });

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
          create: items.map((it) => {
            const qty = new Prisma.Decimal(onHand.get(it.id) ?? "0");
            return {
              itemId: it.id,
              systemQty: qty,
              countedQty: qty,
              varianceQty: new Prisma.Decimal(0),
            };
          }),
        },
      },
    });

    return { id: header.id, docNo, lineCount: items.length };
  });
}

export interface UpdateOpnameLineInput {
  organizationId: string;
  opnameId: string;
  itemId: string;
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

    const line = await tx.stockOpnameLine.findFirst({
      where: { opnameId: input.opnameId, itemId: input.itemId },
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
      include: { lines: { select: { itemId: true, countedQty: true } } },
    });
    if (!header) throw new Error("NOT_FOUND");
    if (header.status !== "DRAFT") throw new Error("NOT_DRAFT");

    // Re-read the current on-hand inside the transaction so concurrent
    // mutations between snapshot and post don't make us write the wrong
    // delta. We treat countedQty as authoritative -- the resulting on-hand
    // after posting is exactly countedQty for each item.
    const itemIds = header.lines.map((l) => l.itemId);
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
    const onHand = await readOnHand(
      tx,
      input.organizationId,
      header.warehouseId,
      itemIds,
    );

    const occurredAt = new Date();
    const rows: Prisma.StockLedgerCreateManyInput[] = [];
    for (const line of header.lines) {
      const current = onHand.get(line.itemId) ?? 0;
      const target = Number(line.countedQty);
      const delta = target - current;
      if (delta === 0) continue;
      rows.push({
        organizationId: input.organizationId,
        occurredAt,
        itemId: line.itemId,
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
      select: { itemId: true, qtyDelta: true },
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

      // Validate that reversing won't drive on-hand negative. Net the per-item
      // reversal deltas first.
      const netRev = new Map<string, number>();
      for (const e of entries) {
        const rev = -Number(e.qtyDelta);
        netRev.set(e.itemId, (netRev.get(e.itemId) ?? 0) + rev);
      }
      const onHand = await readOnHand(
        tx,
        opts.organizationId,
        header.warehouseId,
        itemIds,
      );
      for (const [itemId, rev] of netRev) {
        const available = onHand.get(itemId) ?? 0;
        if (available + rev < 0) {
          throw new InsufficientStockError(
            itemId,
            header.warehouseId,
            Math.abs(rev),
            available,
          );
        }
      }

      const occurredAt = new Date();
      await tx.stockLedger.createMany({
        data: entries.map((e) => ({
          organizationId: opts.organizationId,
          occurredAt,
          itemId: e.itemId,
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
