// Tenant context & helpers
//
// All multi-tenant queries flow through getTenantContext() which resolves the
// current organization from the user session. Every Prisma query that touches
// tenant-owned data MUST filter by `organizationId` (see lib/prisma.ts where
// we expose `tenantDb(orgId)` returning a scoped client). This file provides
// the foundation; concrete usage lands in Sprint 2 (auth + middleware).

export type TenantRole = "OWNER" | "ADMIN" | "OPERATOR" | "VIEWER";

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: TenantRole;
}

export function canMutate(role: TenantRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "OPERATOR";
}

export function canAdminister(role: TenantRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
