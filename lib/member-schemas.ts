import { z } from "zod";

// Roles allowed for invites and for changing an existing member's role.
// OWNER is excluded — only the org's creator (initial OWNER) and any future
// promotion paths can become OWNER, and there must always be ≥1 OWNER per org.
export const ASSIGNABLE_ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const inviteSchema = z.object({
  email: z.string().email().max(120).transform((s) => s.trim().toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES),
});
export type InviteInput = z.infer<typeof inviteSchema>;

// Used for both "change a member's role" and "accept an invite that targeted
// this role" guards. We accept all four roles because internal promotions to
// OWNER are valid; the safeguard against last-OWNER demotion lives in the
// service, not the schema.
export const allRoleSchema = z.enum(["OWNER", "ADMIN", "OPERATOR", "VIEWER"]);

export const updateRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: allRoleSchema,
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1),
});

export const revokeInvitationSchema = z.object({
  invitationId: z.string().min(1),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1),
    // When set, the user is creating a brand new account at the same time.
    // When unset, the user already exists and is providing their existing
    // credentials (the form picks the right shape).
    mode: z.enum(["existing", "new"]),
    name: z.string().min(2).max(120).optional(),
    password: z.string().min(8).max(200),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "new" && (!value.name || value.name.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Name is required for new accounts",
      });
    }
  });
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
