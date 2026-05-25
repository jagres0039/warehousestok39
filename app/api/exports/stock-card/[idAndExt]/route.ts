import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/session";
import { getStockCard } from "@/lib/reports";
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
};

interface RouteCtx {
  params: Promise<{ idAndExt: string }>;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { idAndExt } = await ctx.params;
  // Path segment is e.g. "ckxxxx.xlsx"; strip the extension to get the id.
  const id = idAndExt.replace(/\.xlsx$/i, "");

  const url = new URL(req.url);
  const locale = (url.searchParams.get("locale") ?? "id").trim() || "id";
  const session = await requireTenantSession(locale);

  const sp: Record<string, string | undefined> = {};
  url.searchParams.forEach((v, k) => {
    sp[k] = v;
  });
  const range = parseDateRange(sp);
  const warehouseId = sp.warehouseId || undefined;

  const card = await getStockCard(session.organizationId, id, {
    from: range.from,
    to: range.to,
    warehouseId,
  });
  if (!card) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await buildWorkbook([
    {
      name: "Stock Card",
      title: `Kartu Stok — ${card.item.sku} — ${card.item.name}`,
      subtitle: [
        `Periode: ${range.fromInput || "-"} s/d ${range.toInput || "-"}`,
        warehouseId ? `Gudang: ${warehouseId}` : "Gudang: Semua",
        `Saldo Awal: ${card.openingBalance.toLocaleString("id-ID")} ${card.item.unitCode}`,
        `Saldo Akhir: ${card.closingBalance.toLocaleString("id-ID")} ${card.item.unitCode}`,
        `Generated: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      ],
      columns: [
        { header: "Tanggal", key: "occurredAt" },
        { header: "Gudang", key: "warehouse" },
        { header: "Tipe", key: "type" },
        { header: "No. Dokumen", key: "docNo" },
        { header: "Masuk", key: "qtyIn", numFmt: "#,##0.000", align: "right" },
        { header: "Keluar", key: "qtyOut", numFmt: "#,##0.000", align: "right" },
        { header: "Saldo", key: "balance", numFmt: "#,##0.000", align: "right" },
        { header: "Catatan", key: "note" },
      ],
      rows: card.entries.map((e) => ({
        occurredAt: e.occurredAt.toISOString().slice(0, 16).replace("T", " "),
        warehouse: `${e.warehouseCode} — ${e.warehouseName}`,
        type: MOVE_TYPE_LABEL[e.moveType] ?? e.moveType,
        docNo: e.refDocNo ?? "",
        qtyIn: e.qtyDelta > 0 ? e.qtyDelta : "",
        qtyOut: e.qtyDelta < 0 ? -e.qtyDelta : "",
        balance: e.balanceAfter,
        note: e.note ?? "",
      })),
    },
  ]);

  return new Response(new Uint8Array(buffer), {
    headers: xlsxHeaders(xlsxFilename(`stock-card-${card.item.sku}`)),
  });
}
