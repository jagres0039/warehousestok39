// Server-rendered PDF template for transaction documents (Goods Receipt,
// Goods Issue, Stock Adjustment). Rendered with @react-pdf/renderer in API
// routes; never shipped to the browser.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ReactElement } from "react";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingBottom: 10,
    marginBottom: 14,
  },
  orgName: {
    fontSize: 14,
    fontWeight: 700,
  },
  orgMeta: {
    fontSize: 9,
    color: "#475569",
  },
  docTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  docNo: {
    fontSize: 11,
    fontWeight: 700,
  },
  sectionRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  sectionCol: {
    flex: 1,
    paddingRight: 8,
  },
  fieldLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 10,
  },
  table: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    minHeight: 22,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    fontWeight: 700,
  },
  td: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 9,
  },
  colNo: { width: 22, textAlign: "right" },
  colSku: { width: 80 },
  colName: { flex: 1 },
  colDir: { width: 36, textAlign: "center" },
  colQty: { width: 70, textAlign: "right" },
  colNote: { width: 110 },
  footer: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sign: {
    width: "32%",
    alignItems: "center",
  },
  signLine: {
    marginTop: 50,
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    width: "100%",
    paddingTop: 4,
    fontSize: 9,
    textAlign: "center",
  },
  canceledBanner: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    fontSize: 9,
    borderRadius: 3,
  },
  pageNumber: {
    position: "absolute",
    fontSize: 8,
    bottom: 16,
    left: 0,
    right: 36,
    textAlign: "right",
    color: "#94a3b8",
  },
});

export interface TransactionPdfLine {
  sku: string;
  name: string;
  unit: string;
  qty: number;
  direction?: "IN" | "OUT";
  note?: string | null;
}

export interface TransactionPdfProps {
  title: string;
  organizationName: string;
  organizationAddress?: string | null;
  organizationContact?: string | null;
  docNo: string;
  occurredAt: Date;
  status: "POSTED" | "CANCELED";
  canceledAt?: Date | null;
  cancelReason?: string | null;
  warehouseName: string;
  partnerLabel?: string; // e.g. "Supplier"
  partnerName?: string | null;
  noteLabel?: string;
  note?: string | null;
  lines: TransactionPdfLine[];
  showDirection?: boolean;
  signatureLabels?: { left?: string; center?: string; right?: string };
  generatedLabel: string;
}

export function TransactionPdf(props: TransactionPdfProps): ReactElement {
  const totalQty = props.lines.reduce((a, l) => a + Math.abs(l.qty), 0);
  return (
    <Document title={`${props.title} ${props.docNo}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.orgName}>{props.organizationName}</Text>
            {props.organizationAddress ? (
              <Text style={styles.orgMeta}>{props.organizationAddress}</Text>
            ) : null}
            {props.organizationContact ? (
              <Text style={styles.orgMeta}>{props.organizationContact}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>{props.title}</Text>
            <Text style={styles.docNo}>{props.docNo}</Text>
            <Text style={styles.orgMeta}>
              {props.occurredAt.toISOString().replace("T", " ").slice(0, 16)}
            </Text>
            {props.status === "CANCELED" ? (
              <Text style={{ ...styles.orgMeta, color: "#dc2626", fontWeight: 700 }}>
                * CANCELED *
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionCol}>
            <Text style={styles.fieldLabel}>Gudang</Text>
            <Text style={styles.fieldValue}>{props.warehouseName}</Text>
          </View>
          {props.partnerLabel ? (
            <View style={styles.sectionCol}>
              <Text style={styles.fieldLabel}>{props.partnerLabel}</Text>
              <Text style={styles.fieldValue}>{props.partnerName ?? "-"}</Text>
            </View>
          ) : null}
          <View style={styles.sectionCol}>
            <Text style={styles.fieldLabel}>{props.noteLabel ?? "Catatan"}</Text>
            <Text style={styles.fieldValue}>{props.note ?? "-"}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.td, styles.colNo]}>#</Text>
            <Text style={[styles.td, styles.colSku]}>SKU</Text>
            <Text style={[styles.td, styles.colName]}>Nama Barang</Text>
            {props.showDirection ? (
              <Text style={[styles.td, styles.colDir]}>Arah</Text>
            ) : null}
            <Text style={[styles.td, styles.colQty]}>Qty</Text>
            <Text style={[styles.td, styles.colNote]}>Catatan</Text>
          </View>
          {props.lines.map((l, idx) => (
            <View key={idx} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, styles.colNo]}>{idx + 1}</Text>
              <Text style={[styles.td, styles.colSku]}>{l.sku}</Text>
              <Text style={[styles.td, styles.colName]}>{l.name}</Text>
              {props.showDirection ? (
                <Text style={[styles.td, styles.colDir]}>{l.direction ?? ""}</Text>
              ) : null}
              <Text style={[styles.td, styles.colQty]}>
                {Math.abs(l.qty).toLocaleString("id-ID")} {l.unit}
              </Text>
              <Text style={[styles.td, styles.colNote]}>{l.note ?? ""}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, { fontWeight: 700, backgroundColor: "#f8fafc" }]}>
            <Text style={[styles.td, styles.colNo]}></Text>
            <Text style={[styles.td, styles.colSku]}></Text>
            <Text style={[styles.td, styles.colName]}>TOTAL</Text>
            {props.showDirection ? <Text style={[styles.td, styles.colDir]}></Text> : null}
            <Text style={[styles.td, styles.colQty]}>
              {totalQty.toLocaleString("id-ID")}
            </Text>
            <Text style={[styles.td, styles.colNote]}></Text>
          </View>
        </View>

        {props.status === "CANCELED" && props.cancelReason ? (
          <Text style={styles.canceledBanner}>
            Dibatalkan{" "}
            {props.canceledAt
              ? `pada ${props.canceledAt.toISOString().replace("T", " ").slice(0, 16)}`
              : ""}
            . Alasan: {props.cancelReason}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.sign}>
            <Text style={styles.signLine}>
              {props.signatureLabels?.left ?? "Diserahkan"}
            </Text>
          </View>
          <View style={styles.sign}>
            <Text style={styles.signLine}>
              {props.signatureLabels?.center ?? "Disetujui"}
            </Text>
          </View>
          <View style={styles.sign}>
            <Text style={styles.signLine}>
              {props.signatureLabels?.right ?? "Diterima"}
            </Text>
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${props.generatedLabel} · ${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
