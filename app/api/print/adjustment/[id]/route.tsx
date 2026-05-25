import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TransactionPdf } from "@/lib/pdf-template";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const locale = (url.searchParams.get("locale") ?? "id").trim() || "id";
  const session = await requireTenantSession(locale);

  const adj = await prisma.stockAdjustment.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      warehouse: { select: { code: true, name: true } },
      lines: {
        include: {
          item: { select: { sku: true, name: true, unit: { select: { code: true } } } },
        },
      },
    },
  });
  if (!adj) return new Response("Not found", { status: 404 });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { name: true, address: true, npwp: true },
  });

  const buffer = await renderToBuffer(
    <TransactionPdf
      title="BUKTI PENYESUAIAN STOK"
      organizationName={org.name}
      organizationAddress={org.address}
      organizationContact={org.npwp ? `NPWP: ${org.npwp}` : null}
      docNo={adj.docNo}
      occurredAt={adj.occurredAt}
      status={adj.status}
      canceledAt={adj.canceledAt}
      cancelReason={adj.cancelReason}
      warehouseName={`${adj.warehouse.code} — ${adj.warehouse.name}`}
      note={adj.reason}
      noteLabel="Alasan"
      showDirection
      lines={adj.lines.map((l) => ({
        sku: l.item.sku,
        name: l.item.name,
        unit: l.item.unit.code,
        qty: l.direction === "OUT" ? -Number(l.qty) : Number(l.qty),
        direction: l.direction as "IN" | "OUT",
      }))}
      signatureLabels={{ left: "Dibuat", center: "Disetujui", right: "Mengetahui" }}
      generatedLabel={`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}`}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ADJ-${adj.docNo}.pdf"`,
    },
  });
}
