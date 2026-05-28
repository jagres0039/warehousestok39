import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sendInvitationEmail } from "@/lib/email";
import type { AssignableRole } from "@/lib/member-schemas";
import type { Invitation, Role } from "@prisma/client";

const INVITATION_TTL_DAYS = 7;

export class InvitationError extends Error {
  constructor(
    public readonly code:
      | "ALREADY_MEMBER"
      | "ALREADY_PENDING"
      | "NOT_FOUND"
      | "EXPIRED"
      | "ALREADY_ACCEPTED"
      | "REVOKED"
      | "EMAIL_MISMATCH"
      | "PASSWORD_REQUIRED"
      | "EMAIL_TAKEN_BY_OTHER"
      | "INVALID_CREDENTIALS",
  ) {
    super(code);
    this.name = "InvitationError";
  }
}

function generateToken(): string {
  // 32 random bytes → ~43 URL-safe characters. Plenty of entropy.
  return randomBytes(32).toString("base64url");
}

export interface InvitationListItem {
  id: string;
  email: string;
  role: Role;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
}

export async function listPendingInvitations(orgId: string): Promise<InvitationListItem[]> {
  const rows = await prisma.invitation.findMany({
    where: {
      organizationId: orgId,
      acceptedAt: null,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (rows.length === 0) return [];

  const inviterIds = Array.from(new Set(rows.map((r) => r.invitedById)));
  const inviters = await prisma.user.findMany({
    where: { id: { in: inviterIds } },
    select: { id: true, name: true },
  });
  const inviterById = new Map(inviters.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    token: r.token,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    invitedByName: inviterById.get(r.invitedById) ?? null,
  }));
}

export interface CreateInvitationInput {
  organizationId: string;
  email: string;
  role: AssignableRole;
  invitedById: string;
  inviterName: string;
  organizationName: string;
  baseUrl: string;
  locale: string;
}

export interface CreateInvitationResult {
  invitation: Invitation;
  inviteUrl: string;
}

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const email = input.email.trim().toLowerCase();

  // 1. Already a member of this org?
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.membership.findFirst({
      where: { userId: existingUser.id, organizationId: input.organizationId },
    });
    if (existingMembership) {
      throw new InvitationError("ALREADY_MEMBER");
    }
  }

  // 2. Pending invite already outstanding for this email?
  const existingPending = await prisma.invitation.findFirst({
    where: {
      organizationId: input.organizationId,
      email,
      acceptedAt: null,
      revokedAt: null,
    },
  });
  if (existingPending) {
    throw new InvitationError("ALREADY_PENDING");
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: input.organizationId,
      email,
      role: input.role,
      token,
      invitedById: input.invitedById,
      expiresAt,
    },
  });

  const inviteUrl = buildInviteUrl(input.baseUrl, input.locale, token);
  await sendInvitationEmail({
    to: email,
    organizationName: input.organizationName,
    inviterName: input.inviterName,
    inviteUrl,
    expiresAt,
  });

  return { invitation, inviteUrl };
}

export function buildInviteUrl(baseUrl: string, locale: string, token: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/${locale}/invitation/${token}`;
}

export async function revokeInvitation(
  invitationId: string,
  organizationId: string,
  actorId: string,
): Promise<void> {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId },
  });
  if (!invitation) throw new InvitationError("NOT_FOUND");
  if (invitation.acceptedAt) throw new InvitationError("ALREADY_ACCEPTED");
  if (invitation.revokedAt) return; // idempotent

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date(), revokedById: actorId },
  });
}

export interface InvitationPreview {
  invitationId: string;
  email: string;
  role: Role;
  organizationName: string;
  organizationSlug: string;
  inviterName: string;
  expiresAt: Date;
  userExists: boolean;
}

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true, slug: true } } },
  });
  if (!invitation) throw new InvitationError("NOT_FOUND");
  if (invitation.acceptedAt) throw new InvitationError("ALREADY_ACCEPTED");
  if (invitation.revokedAt) throw new InvitationError("REVOKED");
  if (invitation.expiresAt.getTime() < Date.now()) throw new InvitationError("EXPIRED");

  const inviter = await prisma.user.findUnique({
    where: { id: invitation.invitedById },
    select: { name: true },
  });
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });

  return {
    invitationId: invitation.id,
    email: invitation.email,
    role: invitation.role,
    organizationName: invitation.organization.name,
    organizationSlug: invitation.organization.slug,
    inviterName: inviter?.name ?? "—",
    expiresAt: invitation.expiresAt,
    userExists: existingUser !== null,
  };
}

export interface AcceptInvitationResult {
  email: string;
  organizationId: string;
  role: Role;
  // True if a brand new user was created during accept (used by the UI to
  // decide which auto-login flow to run).
  userCreated: boolean;
}

export async function acceptInvitation(params: {
  token: string;
  mode: "new" | "existing";
  password: string;
  name?: string;
}): Promise<AcceptInvitationResult> {
  // Re-fetch under lock semantics: prisma transaction guarantees the row read
  // here is the one we mutate below. We re-validate every state field because
  // the invitation may have been revoked/accepted between preview and submit.
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({ where: { token: params.token } });
    if (!invitation) throw new InvitationError("NOT_FOUND");
    if (invitation.acceptedAt) throw new InvitationError("ALREADY_ACCEPTED");
    if (invitation.revokedAt) throw new InvitationError("REVOKED");
    if (invitation.expiresAt.getTime() < Date.now()) throw new InvitationError("EXPIRED");

    const email = invitation.email;
    const existingUser = await tx.user.findUnique({ where: { email } });

    let userId: string;
    let userCreated = false;

    if (params.mode === "new") {
      if (existingUser) {
        // The user signed up between preview and accept — fail loudly so they
        // know to use their existing credentials instead of silently merging.
        throw new InvitationError("EMAIL_TAKEN_BY_OTHER");
      }
      if (!params.name) throw new InvitationError("PASSWORD_REQUIRED");
      const passwordHash = await hashPassword(params.password);
      const user = await tx.user.create({
        data: {
          email,
          name: params.name,
          passwordHash,
          locale: "id",
        },
      });
      userId = user.id;
      userCreated = true;
    } else {
      if (!existingUser) {
        // No account with this email — they need to use mode="new".
        throw new InvitationError("INVALID_CREDENTIALS");
      }
      const { verifyPassword } = await import("@/lib/password");
      const ok = await verifyPassword(params.password, existingUser.passwordHash);
      if (!ok) throw new InvitationError("INVALID_CREDENTIALS");
      userId = existingUser.id;
    }

    // Idempotency: if for some reason a membership already exists (race with
    // a concurrent invite accept), skip the create so the operation stays
    // safe to retry.
    const existingMembership = await tx.membership.findFirst({
      where: { userId, organizationId: invitation.organizationId },
    });
    if (!existingMembership) {
      await tx.membership.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedById: userId },
    });

    return {
      email,
      organizationId: invitation.organizationId,
      role: invitation.role,
      userCreated,
    };
  });
}
