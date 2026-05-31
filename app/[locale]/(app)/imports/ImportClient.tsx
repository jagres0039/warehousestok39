"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildCsvTemplate,
  ENTITY_FIELDS,
  IMPORT_ENTITIES,
  type ImportEntity,
  type ImportSummary,
} from "@/lib/imports";

interface EntityActions {
  items: (input: { locale: string; rows: Array<Record<string, string>> }) => Promise<ImportSummary>;
  suppliers: (input: { locale: string; rows: Array<Record<string, string>> }) => Promise<ImportSummary>;
  customers: (input: { locale: string; rows: Array<Record<string, string>> }) => Promise<ImportSummary>;
  categories: (input: { locale: string; rows: Array<Record<string, string>> }) => Promise<ImportSummary>;
  warehouses: (input: { locale: string; rows: Array<Record<string, string>> }) => Promise<ImportSummary>;
}

interface ImportClientProps {
  locale: string;
  unitCodes: string[];
  categoryNames: string[];
  actions: EntityActions;
}

type ParsedRow = Record<string, string>;

export function ImportClient({ locale, unitCodes, categoryNames, actions }: ImportClientProps) {
  const t = useTranslations("imports");
  const [entity, setEntity] = useState<ImportEntity>("items");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fields = ENTITY_FIELDS[entity];

  // Show extra context (valid unit codes / categories) only when the user is
  // on the items tab — keeps the other tabs uncluttered.
  const contextHint = entity === "items"
    ? {
        unitCodes,
        categoryNames,
      }
    : null;

  const reset = () => {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const switchEntity = (next: ImportEntity) => {
    setEntity(next);
    reset();
  };

  const downloadTemplate = () => {
    const csv = buildCsvTemplate(entity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entity}-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    setParseError(null);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(result.errors[0]?.message ?? "Parse error");
          setRows([]);
          return;
        }
        setRows(result.data);
      },
    });
  };

  const runImport = () => {
    setSummary(null);
    startTransition(async () => {
      try {
        const out = await actions[entity]({ locale, rows });
        setSummary(out);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setParseError(message);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">{t("pickEntity")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {IMPORT_ENTITIES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => switchEntity(e)}
                className={
                  e === entity
                    ? "rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-soft"
                    : "rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                }
              >
                {t(`entities.${e}`)}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(`entityIntro.${entity}`)}</p>
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">{t("columnsTitle")}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("downloadTemplate")}
              </Button>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-sm">
                  <Badge variant={f.required ? "warning" : "muted"} className="mt-0.5">
                    {f.required ? t("required") : t("optional")}
                  </Badge>
                  <span>
                    <code className="font-mono text-xs">{f.key}</code>
                    {f.hint && (
                      <span className="ml-2 text-muted-foreground text-xs">{f.hint}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {contextHint && (
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{t("validUnitCodes")}:</span>{" "}
                  {contextHint.unitCodes.length === 0
                    ? t("none")
                    : contextHint.unitCodes.join(", ")}
                </p>
                <p>
                  <span className="font-medium text-foreground">{t("knownCategories")}:</span>{" "}
                  {contextHint.categoryNames.length === 0
                    ? t("none")
                    : contextHint.categoryNames.join(", ")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("uploadTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="import-file"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 text-sm shadow-soft hover:bg-muted"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {t("chooseFile")}
            </label>
            <input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={onFile}
            />
            {fileName && (
              <span className="text-sm text-muted-foreground">
                {fileName} — {t("rowsLoaded", { count: rows.length })}
              </span>
            )}
            {(fileName || summary) && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                {t("reset")}
              </Button>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
              <span>{parseError}</span>
            </div>
          )}

          {rows.length > 0 && !summary && (
            <PreviewTable rows={rows} fields={fields} />
          )}

          {rows.length > 0 && !summary && (
            <div className="flex items-center justify-end gap-2">
              <Button type="button" onClick={runImport} disabled={isPending}>
                {isPending ? t("importing") : t("import", { count: rows.length })}
              </Button>
            </div>
          )}

          {summary && <SummaryView summary={summary} />}
        </CardContent>
      </Card>
    </div>
  );
}

interface PreviewTableProps {
  rows: ParsedRow[];
  fields: ReadonlyArray<{ key: string; required: boolean }>;
}

function PreviewTable({ rows, fields }: PreviewTableProps) {
  const t = useTranslations("imports");
  // Cap the preview at the first 20 rows so a 5000-row CSV doesn't blow up the
  // DOM. The full file still gets sent to the server.
  const preview = rows.slice(0, 20);
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 w-10">#</th>
            {fields.map((f) => (
              <th key={f.key} className="px-3 py-2 whitespace-nowrap">
                {f.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {preview.map((row, idx) => (
            <tr key={idx} className="hover:bg-muted/30">
              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
              {fields.map((f) => (
                <td key={f.key} className="px-3 py-2 align-top">
                  <span className="whitespace-pre-wrap">{(row[f.key] ?? "").toString()}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > preview.length && (
        <div className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("previewTruncated", { shown: preview.length, total: rows.length })}
        </div>
      )}
    </div>
  );
}

function SummaryView({ summary }: { summary: ImportSummary }) {
  const t = useTranslations("imports");
  const issues = useMemo(
    () => summary.results.filter((r) => r.status === "skipped" && r.reason !== "EMPTY_ROW"),
    [summary],
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm">
          <p className="text-muted-foreground">{t("summaryTotal")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.totalRows}</p>
        </div>
        <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          <p>{t("summaryCreated")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.created}</p>
        </div>
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <p>{t("summarySkipped")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.skipped}</p>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2">#</th>
                <th className="px-3 py-2">{t("reason")}</th>
                <th className="px-3 py-2">{t("details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {issues.map((r) => (
                <tr key={r.rowNumber} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.rowNumber}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                      <span>{t(`reasons.${r.reason ?? "INVALID_VALUE"}`)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.key && <span className="font-mono">{r.key}</span>}
                    {r.key && r.message && <span> — </span>}
                    {r.message && <span>{r.message}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <span>{t("allCreated")}</span>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5" aria-hidden="true" />
        <span>{t("partialImportNote")}</span>
      </div>
    </div>
  );
}
