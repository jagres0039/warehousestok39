import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/session";
import { getLowStockReport } from "@/lib/reports";
import { buildWorkbook, xlsxFilename, xlsxHeaders } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const locale = (url.searchParams.get("locale") ?? "id").trim() || "id";
  const session = await requireTenantSession(locale);

  const warehouseId = url.searchParams.get("warehouseId") || undefined;
  const rows = await getLowStockReport(session.organizationId, { warehouseId });

  const buffer = await buildWorkbook([
    {
      name: "Low Stock",
      title: `Laporan Stok Rendah — ${session.organizationName}`,
      subtitle: [
        warehouseId ? `Gudang: ${warehouseId}` : "Gudang: Semua",
        `Generated: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      ],
      columns: [
        { header: "SKU", key: "sku" },
        { header: "Nama Barang", key: "name" },
        { header: "Satuan", key: "unit" },
        { header: "Min Stok", key: "minStock", numFmt: "#,##0.000", align: "right" },
        { header: "Stok Saat Ini", key: "onHand", numFmt: "#,##0.000", align: "right" },
        { header: "Kekurangan", key: "shortBy", numFmt: "#,##0.000", align: "right" },
      ],
      rows: rows.map((r) => ({
        sku: r.sku,
        name: r.name,
        unit: r.unitCode,
        minStock: r.minStock,
        onHand: r.onHand,
        shortBy: r.shortBy,
      })),
    },
  ]);

  return new Response(new Uint8Array(buffer), {
    headers: xlsxHeaders(xlsxFilename("low-stock")),
  });
}
