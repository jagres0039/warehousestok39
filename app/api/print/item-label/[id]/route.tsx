import { NextRequest } from "next/server";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

const styles = StyleSheet.create({
  page: {
    padding: 18,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 12,
    border: "1pt solid #cbd5e1",
    borderRadius: 6,
  },
  qrBox: {
    width: 120,
    height: 120,
    padding: 4,
    backgroundColor: "#ffffff",
  },
  qr: {
    width: "100%",
    height: "100%",
  },
  meta: {
    flex: 1,
    paddingLeft: 12,
  },
  orgName: {
    fontSize: 9,
    color: "#475569",
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 2,
  },
  sku: {
    fontSize: 11,
    fontFamily: "Courier",
    marginTop: 4,
  },
  small: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },
});

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const locale = (url.searchParams.get("locale") ?? "id").trim() || "id";
  const session = await requireTenantSession(locale);

  const item = await prisma.item.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      sku: true,
      name: true,
      barcode: true,
      unit: { select: { code: true } },
    },
  });
  if (!item) return new Response("Not found", { status: 404 });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { name: true },
  });

  // Encode the barcode if set; otherwise fall back to the SKU. Either way the
  // resulting QR scans to a value that uniquely identifies the item within the
  // tenant.
  const payload = (item.barcode && item.barcode.length > 0 ? item.barcode : item.sku);
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });

  const buffer = await renderToBuffer(
    <Document title={`Label ${item.sku}`}>
      <Page size={{ width: 360, height: 180 }} style={styles.page}>
        <View style={styles.card}>
          <View style={styles.qrBox}>
            {/* @react-pdf Image has no alt prop; rule only applies to <img>. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrDataUrl} style={styles.qr} />
          </View>
          <View style={styles.meta}>
            <Text style={styles.orgName}>{org.name}</Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sku}>
              {item.sku}
              {item.unit?.code ? ` · ${item.unit.code}` : ""}
            </Text>
            {item.barcode ? (
              <Text style={styles.small}>{item.barcode}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="label-${item.sku}.pdf"`,
    },
  });
}
