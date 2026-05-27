import { z } from "zod";

// Tenant-editable organization profile. The slug is allocated at registration
// and stays immutable (changing it would break document numbering, ledger
// history, and any external bookmarks), so it is not part of this schema.
export const organizationSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(500).optional().or(z.literal("")),
  npwp: z.string().max(40).optional().or(z.literal("")),
  logoUrl: z.string().url().max(500).optional().or(z.literal("")),
  currency: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z]{2,8}$/i, "Use a currency code like IDR, USD, EUR."),
  timezone: z.string().min(1).max(64),
  defaultLocale: z.enum(["id", "en"]),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;

// Document number templates are restricted to a small character class so that
// renderers and storage stay predictable across PDF, CSV, and filenames.
// Allowed: letters, digits, `_`, `-`, `/`, `.`, `:` and the `{}` braces used
// by placeholder tokens like `{YYYY}` and `{SEQ:4}`.
const TEMPLATE_RE = /^[A-Za-z0-9_\-\/.:{}]+$/;

export const docNumberConfigSchema = z.object({
  template: z
    .string()
    .min(3)
    .max(80)
    .regex(
      TEMPLATE_RE,
      "Use letters, digits, and any of '-_/.:' plus placeholders like {YYYY}.",
    )
    .refine((t) => /\{SEQ:\d+\}/.test(t), {
      message: "Template must include a {SEQ:N} placeholder (e.g. {SEQ:4}).",
    }),
  resetPolicy: z.enum(["never", "yearly", "monthly"]),
});
export type DocNumberConfigInput = z.infer<typeof docNumberConfigSchema>;
