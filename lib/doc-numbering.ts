// Document numbering template engine.
//
// Tenants configure their own document number formats via Settings.
// Template placeholders:
//   {PREFIX}  - literal prefix string stored in config (not parsed here)
//   {YYYY}    - 4-digit year
//   {YY}      - 2-digit year
//   {MM}      - 2-digit month (01-12)
//   {DD}      - 2-digit day (01-31)
//   {SEQ:N}   - zero-padded counter, N digits (e.g. {SEQ:4} -> "0001")
//   {ORG}     - short organization code (slug, uppercased)
//
// Counter reset policies (handled when persisting the counter, not in this module):
//   - "never"   : counter never resets
//   - "yearly"  : counter resets at the start of each year
//   - "monthly" : counter resets at the start of each month

export type ResetPolicy = "never" | "yearly" | "monthly";

export interface NumberingInput {
  template: string;
  counter: number;
  now: Date;
  orgCode?: string;
}

const SEQ_RE = /\{SEQ:(\d+)\}/g;

export function renderDocumentNumber({
  template,
  counter,
  now,
  orgCode,
}: NumberingInput): string {
  const yyyy = String(now.getUTCFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  return template
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{ORG\}/g, (orgCode ?? "").toUpperCase())
    .replace(SEQ_RE, (_match, n: string) => {
      const width = Math.max(1, Math.min(parseInt(n, 10) || 1, 12));
      return String(counter).padStart(width, "0");
    });
}

export function counterPeriodKey(policy: ResetPolicy, now: Date): string {
  switch (policy) {
    case "yearly":
      return String(now.getUTCFullYear());
    case "monthly":
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    case "never":
    default:
      return "all";
  }
}

/**
 * Render a sample document number for the Settings UI preview. Pure function;
 * safe to call from client components (no DB access).
 */
export function previewDocumentNumber(
  template: string,
  orgCode?: string,
  sampleCounter = 1,
  now: Date = new Date(),
): string {
  return renderDocumentNumber({ template, counter: sampleCounter, now, orgCode });
}
