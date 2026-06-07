import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/session";
import { getMovementReport } from "@/lib/reports";
import { parseDateRange } from "@/lib/date-range";
import { buildWorkbook, xlsxFilename, xlsxHeaders } from "@/lib/excel";

export const dynamic = "force-dynamic";

const MOVE_TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Barang Masuk",
  ISSUE: "Barang Keluar",
  ADJUSTMENT_IN: "Adj. Masuk",
  ADJUSTMENT_OUT: "Adj. Keluar",
  RECEIPT_REVERSAL: "Pembatalan Masuk",
  ISSUE_REVERSAL: "Pembatalan Keluar",
  ADJUSTMENT_REVERSAL: "Pembatalan Adj.",
  TRANSFER_OUT: "Transfer Keluar",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_REVERSAL: "Pembatalan Transfer",
  OPNAME_IN: "Opname Masuk",
  OPNAME_OUT: "Opname Keluar",
  OPNAME_REVERSAL: "Pembatalan Opname",
};

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const locale = (url.searchParams.get("locale") ?? "id").trim() || "id";
  const session = await requireTenantSession(locale);

  const sp: Record<string, string | undefined> = {};
  url.searchParams.forEach((v, k) => {
    sp[k] = v;
  });
  const range = parseDateRange(sp);
  const warehouseId = sp.warehouseId || undefined;
  const refType = sp.refType as
    | "GoodsReceipt"
    | "GoodsIssue"
    | "StockAdjustment"
    | "StockTransfer"
    | "StockOpname"
    | undefined;

  const rows = await getMovementReport(session.organizationId, {
    from: range.from,
    to: range.to,
    warehouseId,
    refType,
  });

  const totalIn = rows.reduce((a, r) => a + (r.qtyDelta > 0 ? r.qtyDelta : 0), 0);
  const totalOut = rows.reduce((a, r) => a + (r.qtyDelta < 0 ? -r.qtyDelta : 0), 0);

  const buffer = await buildWorkbook([
    {
      name: "Movements",
      title: `Laporan Mutasi Stok — ${session.organizationName}`,
      subtitle: [
        `Periode: ${range.fromInput || "-"} s/d ${range.toInput || "-"}`,
        warehouseId ? `Gudang: ${warehouseId}` : "Gudang: Semua",
        refType ? `Tipe: ${refType}` : "Tipe: Semua",
        `Generated: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      ],
      columns: [
        { header: "Tanggal", key: "occurredAt" },
        { header: "Gudang", key: "warehouse" },
        { header: "SKU", key: "sku" },
        { header: "Nama Barang", key: "name" },
        { header: "Satuan", key: "unit" },
        { header: "Tipe", key: "type" },
        { header: "No. Dokumen", key: "docNo" },
        { header: "Masuk", key: "qtyIn", numFmt: "#,##0.000", align: "right" },
        { header: "Keluar", key: "qtyOut", numFmt: "#,##0.000", align: "right" },
        { header: "Catatan", key: "note" },
      ],
      rows: rows.map((r) => ({
        occurredAt: r.occurredAt.toISOString().slice(0, 16).replace("T", " "),
        warehouse: `${r.warehouseCode} — ${r.warehouseName}`,
        sku: r.itemSku,
        name: r.itemName,
        unit: r.unitCode,
        type: MOVE_TYPE_LABEL[r.moveType] ?? r.moveType,
        docNo: r.refDocNo ?? "",
        qtyIn: r.qtyDelta > 0 ? r.qtyDelta : "",
        qtyOut: r.qtyDelta < 0 ? -r.qtyDelta : "",
        note: r.note ?? "",
      })),
      footer: {
        occurredAt: "TOTAL",
        qtyIn: totalIn,
        qtyOut: totalOut,
      },
    },
  ]);

  return new Response(new Uint8Array(buffer), {
    headers: xlsxHeaders(xlsxFilename(`movements-${range.fromInput || "all"}-${range.toInput || "all"}`)),
  });
}
