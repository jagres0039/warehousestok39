// Report queries for Sprint 5 (stock card, movements, low-stock).
//
// All queries are tenant-scoped via `organizationId`. The stock card and
// movement report read directly from `StockLedger` (the canonical audit log),
// so they include reversal entries from cancelled transactions.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface StockCardEntry {
  id: string;
  occurredAt: Date;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  moveType: string;
  refType: string;
  refId: string;
  refDocNo: string | null;
  qtyDelta: number;
  balanceAfter: number;
  note: string | null;
}

export interface StockCardResult {
  item: {
    id: string;
    sku: string;
    name: string;
    unitCode: string;
  };
  entries: StockCardEntry[];
  openingBalance: number;
  closingBalance: number;
}

/**
 * Build a stock card for one item. Returns every ledger entry in the period
 * (sorted ascending by occurredAt, then by created order) with a running
 * balance that already reflects activity BEFORE the `from` date.
 */
export async function getStockCard(
  organizationId: string,
  itemId: string,
  opts: DateRange & { warehouseId?: string } = {},
): Promise<StockCardResult | null> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, organizationId },
    include: { unit: { select: { code: true } } },
  });
  if (!item) return null;

  const where: Prisma.StockLedgerWhereInput = {
    organizationId,
    itemId,
    ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
  };

  let openingBalance = 0;
  if (opts.from) {
    const opening = await prisma.stockLedger.aggregate({
      where: { ...where, occurredAt: { lt: opts.from } },
      _sum: { qtyDelta: true },
    });
    openingBalance = Number(opening._sum.qtyDelta ?? 0);
  }

  const periodWhere: Prisma.StockLedgerWhereInput = {
    ...where,
    occurredAt: {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    },
  };
  const rows = await prisma.stockLedger.findMany({
    where: periodWhere,
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    include: {
      warehouse: { select: { code: true, name: true } },
    },
  });

  const refIdsByType = new Map<string, string[]>();
  for (const r of rows) {
    const arr = refIdsByType.get(r.refType) ?? [];
    arr.push(r.refId);
    refIdsByType.set(r.refType, arr);
  }
  const docNoByRef = new Map<string, string>();
  for (const [refType, ids] of refIdsByType) {
    const uniqueIds = Array.from(new Set(ids));
    if (refType === "GoodsReceipt") {
      const recs = await prisma.goodsReceipt.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`GoodsReceipt:${r.id}`, r.docNo);
    } else if (refType === "GoodsIssue") {
      const recs = await prisma.goodsIssue.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`GoodsIssue:${r.id}`, r.docNo);
    } else if (refType === "StockAdjustment") {
      const recs = await prisma.stockAdjustment.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`StockAdjustment:${r.id}`, r.docNo);
    } else if (refType === "StockTransfer") {
      const recs = await prisma.stockTransfer.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`StockTransfer:${r.id}`, r.docNo);
    } else if (refType === "StockOpname") {
      const recs = await prisma.stockOpname.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`StockOpname:${r.id}`, r.docNo);
    }
  }

  let running = openingBalance;
  const entries: StockCardEntry[] = rows.map((r) => {
    const delta = Number(r.qtyDelta);
    running += delta;
    return {
      id: r.id,
      occurredAt: r.occurredAt,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouse.code,
      warehouseName: r.warehouse.name,
      moveType: r.moveType,
      refType: r.refType,
      refId: r.refId,
      refDocNo: docNoByRef.get(`${r.refType}:${r.refId}`) ?? null,
      qtyDelta: delta,
      balanceAfter: running,
      note: r.note,
    };
  });

  return {
    item: {
      id: item.id,
      sku: item.sku,
      name: item.name,
      unitCode: item.unit.code,
    },
    entries,
    openingBalance,
    closingBalance: running,
  };
}

export interface MovementRow {
  id: string;
  occurredAt: Date;
  warehouseCode: string;
  warehouseName: string;
  itemSku: string;
  itemName: string;
  unitCode: string;
  moveType: string;
  refType: string;
  refId: string;
  refDocNo: string | null;
  qtyDelta: number;
  note: string | null;
}

export interface MovementFilter {
  from?: Date;
  to?: Date;
  warehouseId?: string;
  refType?:
    | "GoodsReceipt"
    | "GoodsIssue"
    | "StockAdjustment"
    | "StockTransfer"
    | "StockOpname";
}

/**
 * Flat per-line movement report across all transactions. Useful for accounting
 * cross-checks and Excel exports.
 */
export async function getMovementReport(
  organizationId: string,
  opts: MovementFilter = {},
): Promise<MovementRow[]> {
  const where: Prisma.StockLedgerWhereInput = {
    organizationId,
    ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
    ...(opts.refType ? { refType: opts.refType } : {}),
    occurredAt: {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    },
  };
  const rows = await prisma.stockLedger.findMany({
    where,
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    include: {
      warehouse: { select: { code: true, name: true } },
      item: {
        select: { sku: true, name: true, unit: { select: { code: true } } },
      },
    },
    take: 5000,
  });

  const refIdsByType = new Map<string, string[]>();
  for (const r of rows) {
    const arr = refIdsByType.get(r.refType) ?? [];
    arr.push(r.refId);
    refIdsByType.set(r.refType, arr);
  }
  const docNoByRef = new Map<string, string>();
  for (const [refType, ids] of refIdsByType) {
    const uniqueIds = Array.from(new Set(ids));
    if (refType === "GoodsReceipt") {
      const recs = await prisma.goodsReceipt.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`GoodsReceipt:${r.id}`, r.docNo);
    } else if (refType === "GoodsIssue") {
      const recs = await prisma.goodsIssue.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`GoodsIssue:${r.id}`, r.docNo);
    } else if (refType === "StockAdjustment") {
      const recs = await prisma.stockAdjustment.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`StockAdjustment:${r.id}`, r.docNo);
    } else if (refType === "StockTransfer") {
      const recs = await prisma.stockTransfer.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`StockTransfer:${r.id}`, r.docNo);
    } else if (refType === "StockOpname") {
      const recs = await prisma.stockOpname.findMany({
        where: { id: { in: uniqueIds }, organizationId },
        select: { id: true, docNo: true },
      });
      for (const r of recs) docNoByRef.set(`StockOpname:${r.id}`, r.docNo);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurredAt,
    warehouseCode: r.warehouse.code,
    warehouseName: r.warehouse.name,
    itemSku: r.item.sku,
    itemName: r.item.name,
    unitCode: r.item.unit.code,
    moveType: r.moveType,
    refType: r.refType,
    refId: r.refId,
    refDocNo: docNoByRef.get(`${r.refType}:${r.refId}`) ?? null,
    qtyDelta: Number(r.qtyDelta),
    note: r.note,
  }));
}

export interface LowStockRow {
  itemId: string;
  sku: string;
  name: string;
  unitCode: string;
  minStock: number;
  onHand: number;
  shortBy: number;
}

interface OnHandQueryRow {
  itemId: string;
  qty: number;
}

/**
 * Items whose total on-hand (across all warehouses, or in a specific warehouse
 * if provided) is below their configured `minStock`. Returns ordered worst-first.
 */
export async function getLowStockReport(
  organizationId: string,
  opts: { warehouseId?: string } = {},
): Promise<LowStockRow[]> {
  const items = await prisma.item.findMany({
    where: {
      organizationId,
      isActive: true,
      minStock: { gt: 0 },
    },
    include: { unit: { select: { code: true } } },
  });
  if (items.length === 0) return [];

  const onHandRows = opts.warehouseId
    ? await prisma.$queryRaw<OnHandQueryRow[]>`
        SELECT "itemId", COALESCE(SUM("qtyDelta"), 0)::float8 AS qty
        FROM "StockLedger"
        WHERE "organizationId" = ${organizationId}
          AND "warehouseId"    = ${opts.warehouseId}
        GROUP BY "itemId"
      `
    : await prisma.$queryRaw<OnHandQueryRow[]>`
        SELECT "itemId", COALESCE(SUM("qtyDelta"), 0)::float8 AS qty
        FROM "StockLedger"
        WHERE "organizationId" = ${organizationId}
        GROUP BY "itemId"
      `;
  const onHand = new Map(onHandRows.map((r) => [r.itemId, Number(r.qty)]));

  const out: LowStockRow[] = [];
  for (const item of items) {
    const qty = onHand.get(item.id) ?? 0;
    const min = Number(item.minStock);
    if (qty < min) {
      out.push({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        unitCode: item.unit.code,
        minStock: min,
        onHand: qty,
        shortBy: min - qty,
      });
    }
  }
  out.sort((a, b) => b.shortBy - a.shortBy);
  return out;
}
