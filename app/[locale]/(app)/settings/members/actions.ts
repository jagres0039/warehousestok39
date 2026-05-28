"use server";

import { revalidatePath } from "next/cache";
import { requireTenantSession } from "@/lib/session";
import { assertCanAdminister } from "@/lib/role-guard";
import { createInvitation, revokeInvitation, InvitationError, buildInviteUrl } from "@/lib/invitations";
import { updateMemberRole, removeMember, MemberError } from "@/lib/members";
import { inviteSchema, updateRoleSchema, removeMemberSchema, revokeInvitationSchema } from "@/lib/member-schemas";
import type { Role } from "@prisma/client";

// ── Invite member ──────────────────────────────────────────────────────────

export interface InviteResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  inviteUrl?: string;
}

export async function inviteMemberAction(
  _prev: InviteResult | undefined,
  formData: FormData,
): Promise<InviteResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "invite member");

  const raw = {
    email: String(formData.get("email") ?? "").trim(),
    role: String(formData.get("role") ?? "OPERATOR"),
  };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const baseUrl = process.env.APP_URL || "http://localhost:3000";

  try {
    const result = await createInvitation({
      organizationId: session.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedById: session.userId,
      inviterName: session.name,
      organizationName: session.organizationName,
      baseUrl,
      locale,
    });
    revalidatePath(`/${locale}/settings/members`);
    return { ok: true, inviteUrl: result.inviteUrl };
  } catch (err) {
    if (err instanceof InvitationError) {
      return { ok: false, error: err.code };
    }
    throw err;
  }
}

// ── Revoke invitation ──────────────────────────────────────────────────────

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "revoke invitation");

  const parsed = revokeInvitationSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) return;

  try {
    await revokeInvitation(parsed.data.invitationId, session.organizationId, session.userId);
  } catch (err) {
    if (err instanceof InvitationError) return;
    throw err;
  }
  revalidatePath(`/${locale}/settings/members`);
}

// ── Copy invitation link (re-build URL for an existing pending invite) ─────

export async function getInviteLinkAction(
  token: string,
  locale: string,
): Promise<string> {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  return buildInviteUrl(baseUrl, locale, token);
}

// ── Change role ────────────────────────────────────────────────────────────

export interface RoleChangeResult {
  ok: boolean;
  error?: string;
}

export async function updateMemberRoleAction(
  _prev: RoleChangeResult | undefined,
  formData: FormData,
): Promise<RoleChangeResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "update member role");

  const parsed = updateRoleSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: "INVALID_ROLE" };
  }

  try {
    await updateMemberRole({
      organizationId: session.organizationId,
      membershipId: parsed.data.membershipId,
      newRole: parsed.data.role as Role,
      actorUserId: session.userId,
    });
  } catch (err) {
    if (err instanceof MemberError) {
      return { ok: false, error: err.code };
    }
    throw err;
  }

  revalidatePath(`/${locale}/settings/members`);
  return { ok: true };
}

// ── Remove member ──────────────────────────────────────────────────────────

export async function removeMemberAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "remove member");

  const parsed = removeMemberSchema.safeParse({
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success) return;

  try {
    await removeMember({
      organizationId: session.organizationId,
      membershipId: parsed.data.membershipId,
      actorUserId: session.userId,
    });
  } catch (err) {
    if (err instanceof MemberError) return;
    throw err;
  }
  revalidatePath(`/${locale}/settings/members`);
}
