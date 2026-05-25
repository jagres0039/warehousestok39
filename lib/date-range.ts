// Small helpers shared by report pages.

export interface ParsedRange {
  fromInput: string;
  toInput: string;
  from?: Date;
  to?: Date;
}

/**
 * Parse `from`/`to` URL params (ISO date strings) into Date objects. The
 * `to` value is bumped to end-of-day so date-only inputs are inclusive.
 */
export function parseDateRange(sp: Record<string, string | undefined>): ParsedRange {
  const fromInput = (sp.from ?? "").trim();
  const toInput = (sp.to ?? "").trim();
  let from: Date | undefined;
  let to: Date | undefined;
  if (fromInput) {
    const d = new Date(fromInput);
    if (!Number.isNaN(d.getTime())) from = d;
  }
  if (toInput) {
    const d = new Date(toInput);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      to = d;
    }
  }
  return { fromInput, toInput, from, to };
}

export function formatDateInput(d?: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayInput(): string {
  return formatDateInput(new Date());
}
