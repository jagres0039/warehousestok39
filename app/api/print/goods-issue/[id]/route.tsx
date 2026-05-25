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

  const issue = await prisma.goodsIssue.findFirst({
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
  if (!issue) return new Response("Not found", { status: 404 });

  const customer = issue.customerId
    ? await prisma.customer.findFirst({
        where: { id: issue.customerId, organizationId: session.organizationId },
        select: { name: true },
      })
    : null;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { name: true, address: true, npwp: true },
  });

  const buffer = await renderToBuffer(
    <TransactionPdf
      title="BUKTI BARANG KELUAR"
      organizationName={org.name}
      organizationAddress={org.address}
      organizationContact={org.npwp ? `NPWP: ${org.npwp}` : null}
      docNo={issue.docNo}
      occurredAt={issue.occurredAt}
      status={issue.status}
      canceledAt={issue.canceledAt}
      cancelReason={issue.cancelReason}
      warehouseName={`${issue.warehouse.code} — ${issue.warehouse.name}`}
      partnerLabel="Customer"
      partnerName={customer?.name}
      note={issue.note}
      lines={issue.lines.map((l) => ({
        sku: l.item.sku,
        name: l.item.name,
        unit: l.item.unit.code,
        qty: Number(l.qty),
      }))}
      signatureLabels={{ left: "Diserahkan", center: "Disetujui", right: "Diterima" }}
      generatedLabel={`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}`}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="GI-${issue.docNo}.pdf"`,
    },
  });
}
