import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import type { TenantRole } from "@/lib/tenancy";

export interface CurrentUserSession {
  userId: string;
  email: string;
  name: string;
  locale: string;
  activeOrganizationId: string | null;
  activeRole: Role | null;
}

export async function getCurrentSession(): Promise<CurrentUserSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    locale: session.user.locale ?? "id",
    activeOrganizationId: session.activeOrganizationId,
    activeRole: session.activeRole,
  };
}

export async function requireSession(locale: string): Promise<CurrentUserSession> {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }
  return session;
}

export interface TenantSession {
  userId: string;
  email: string;
  name: string;
  locale: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: TenantRole;
}

export async function requireTenantSession(locale: string): Promise<TenantSession> {
  const session = await requireSession(locale);

  if (!session.activeOrganizationId) {
    // Membership got dropped or token is stale — bounce to login to refresh.
    redirect(`/${locale}/login`);
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      organizationId: session.activeOrganizationId,
    },
    include: { organization: true },
  });

  if (!membership) {
    redirect(`/${locale}/login`);
  }

  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    locale: session.locale,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role as TenantRole,
  };
}
