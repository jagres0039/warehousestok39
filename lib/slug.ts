// Slugify helper for Organization.slug.
// Strips diacritics, lowercases, replaces non-alphanumerics with dashes,
// trims dashes from the ends, and clamps length so DB indexes stay tidy.

export function slugify(input: string, maxLength = 48): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base) return "org";
  return base.length > maxLength ? base.slice(0, maxLength).replace(/-+$/, "") : base;
}

// Append a short random suffix to disambiguate slugs after a collision.
export function withRandomSuffix(slug: string, length = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${slug}-${out}`;
}
