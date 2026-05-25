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

  const receipt = await prisma.goodsReceipt.findFirst({
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
  if (!receipt) return new Response("Not found", { status: 404 });

  const supplier = receipt.supplierId
    ? await prisma.supplier.findFirst({
        where: { id: receipt.supplierId, organizationId: session.organizationId },
        select: { name: true },
      })
    : null;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { name: true, address: true, npwp: true },
  });

  const buffer = await renderToBuffer(
    <TransactionPdf
      title="BUKTI BARANG MASUK"
      organizationName={org.name}
      organizationAddress={org.address}
      organizationContact={org.npwp ? `NPWP: ${org.npwp}` : null}
      docNo={receipt.docNo}
      occurredAt={receipt.occurredAt}
      status={receipt.status}
      canceledAt={receipt.canceledAt}
      cancelReason={receipt.cancelReason}
      warehouseName={`${receipt.warehouse.code} — ${receipt.warehouse.name}`}
      partnerLabel="Supplier"
      partnerName={supplier?.name}
      note={receipt.note}
      lines={receipt.lines.map((l) => ({
        sku: l.item.sku,
        name: l.item.name,
        unit: l.item.unit.code,
        qty: Number(l.qty),
      }))}
      generatedLabel={`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}`}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="GR-${receipt.docNo}.pdf"`,
    },
  });
}
