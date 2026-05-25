// Excel export helpers using exceljs. Each report returns a buffer streamed
// back as a `xlsx` file. Sheets share basic styling: bold header row, frozen
// first row, auto-sized columns based on the longest cell.

import ExcelJS from "exceljs";

interface SheetColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  align?: "left" | "center" | "right";
}

export interface SheetSpec {
  name: string;
  columns: SheetColumn[];
  rows: Record<string, unknown>[];
  /** Optional per-cell footer (e.g. totals); rendered as a separate row at the bottom. */
  footer?: Record<string, unknown>;
  /** Optional title block above the column headers (e.g. report parameters). */
  title?: string;
  subtitle?: string[];
}

export async function buildWorkbook(sheets: SheetSpec[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "warehousestok39";
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    let cursor = 1;
    if (sheet.title) {
      const titleRow = ws.getRow(cursor++);
      titleRow.getCell(1).value = sheet.title;
      titleRow.getCell(1).font = { bold: true, size: 14 };
      ws.mergeCells(titleRow.number, 1, titleRow.number, sheet.columns.length);
    }
    if (sheet.subtitle) {
      for (const line of sheet.subtitle) {
        const r = ws.getRow(cursor++);
        r.getCell(1).value = line;
        r.getCell(1).font = { italic: true, color: { argb: "FF666666" } };
        ws.mergeCells(r.number, 1, r.number, sheet.columns.length);
      }
    }
    if (sheet.title || sheet.subtitle) cursor++; // blank spacer row

    const headerRowIdx = cursor++;
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? Math.max(12, c.header.length + 2),
      style: {
        numFmt: c.numFmt,
        alignment: c.align ? { horizontal: c.align } : undefined,
      },
    }));
    // exceljs already writes headers when `columns` is set, but if we have a
    // title block above we must move the header row down ourselves.
    if (headerRowIdx > 1) {
      // Move the header to headerRowIdx.
      const originalHeaderRow = ws.getRow(1);
      originalHeaderRow.values = [];
      const targetRow = ws.getRow(headerRowIdx);
      targetRow.values = sheet.columns.map((c) => c.header);
    }
    const headerRow = ws.getRow(headerRowIdx);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle" };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

    for (const row of sheet.rows) {
      ws.addRow(row);
    }

    if (sheet.footer) {
      const footerRow = ws.addRow(sheet.footer);
      footerRow.font = { bold: true };
      footerRow.border = { top: { style: "thin" } };
    }

    // Auto-size: bump widths to fit the longest cell value, up to a cap.
    ws.columns.forEach((col, idx) => {
      const colLetter = idx + 1;
      let maxLen = (col.header as string)?.length ?? 0;
      ws.getColumn(colLetter).eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        const s = v == null ? "" : String(v);
        if (s.length > maxLen) maxLen = s.length;
      });
      col.width = Math.min(60, Math.max(col.width ?? 10, maxLen + 2));
    });
  }

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Buffer;
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}

export function xlsxFilename(stem: string): string {
  const safe = stem.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${safe}.xlsx`;
}

export function xlsxHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
