import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export class MemberError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "LAST_OWNER"
      | "CANNOT_TOUCH_SELF"
      | "INVALID_ROLE",
  ) {
    super(code);
    this.name = "MemberError";
  }
}

export interface MemberListItem {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  isSelf: boolean;
}

// Display order — highest privilege first so OWNER rows are obvious.
const ROLE_ORDER: Record<Role, number> = {
  OWNER: 0,
  ADMIN: 1,
  OPERATOR: 2,
  VIEWER: 3,
};

export async function listMembers(
  organizationId: string,
  currentUserId: string,
): Promise<MemberListItem[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const mapped = memberships.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    createdAt: m.createdAt,
    isSelf: m.userId === currentUserId,
  }));
  mapped.sort((a, b) => {
    const r = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (r !== 0) return r;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return mapped;
}

async function ensureNotLastOwner(
  organizationId: string,
  membershipId: string,
  newRole: Role | null,
): Promise<void> {
  // newRole === null means we're removing the member entirely. In both the
  // demote and remove cases the guarantee is: at least one OWNER must remain
  // in the org after the change. If the targeted membership isn't currently
  // OWNER, there's nothing to check.
  const target = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { role: true, organizationId: true },
  });
  if (!target) throw new MemberError("NOT_FOUND");
  if (target.organizationId !== organizationId) throw new MemberError("NOT_FOUND");
  if (target.role !== "OWNER") return;
  if (newRole === "OWNER") return; // role isn't actually changing away from OWNER

  const ownerCount = await prisma.membership.count({
    where: { organizationId, role: "OWNER" },
  });
  if (ownerCount <= 1) {
    throw new MemberError("LAST_OWNER");
  }
}

export async function updateMemberRole(params: {
  organizationId: string;
  membershipId: string;
  newRole: Role;
  actorUserId: string;
}): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { id: params.membershipId },
    select: { userId: true, organizationId: true, role: true },
  });
  if (!membership) throw new MemberError("NOT_FOUND");
  if (membership.organizationId !== params.organizationId) throw new MemberError("NOT_FOUND");

  // Don't let an admin demote themselves and lock themselves out of admin
  // surfaces by accident. They can still ask another OWNER/ADMIN to do it.
  if (membership.userId === params.actorUserId && membership.role !== params.newRole) {
    throw new MemberError("CANNOT_TOUCH_SELF");
  }

  await ensureNotLastOwner(params.organizationId, params.membershipId, params.newRole);

  await prisma.membership.update({
    where: { id: params.membershipId },
    data: { role: params.newRole },
  });
}

export async function removeMember(params: {
  organizationId: string;
  membershipId: string;
  actorUserId: string;
}): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { id: params.membershipId },
    select: { userId: true, organizationId: true },
  });
  if (!membership) throw new MemberError("NOT_FOUND");
  if (membership.organizationId !== params.organizationId) throw new MemberError("NOT_FOUND");
  if (membership.userId === params.actorUserId) throw new MemberError("CANNOT_TOUCH_SELF");

  await ensureNotLastOwner(params.organizationId, params.membershipId, null);

  await prisma.membership.delete({ where: { id: params.membershipId } });
}
