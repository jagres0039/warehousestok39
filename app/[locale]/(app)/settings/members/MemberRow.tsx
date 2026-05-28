"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateMemberRoleAction, removeMemberAction, type RoleChangeResult } from "./actions";

interface MemberRowProps {
  membershipId: string;
  email: string;
  name: string;
  role: string;
  isSelf: boolean;
  isAdmin: boolean;
  locale: string;
}

const ROLE_VARIANTS: Record<string, "success" | "muted"> = {
  OWNER: "success",
  ADMIN: "success",
  OPERATOR: "muted",
  VIEWER: "muted",
};

export function MemberRow({
  membershipId,
  email,
  name,
  role: initialRole,
  isSelf,
  isAdmin,
  locale,
}: MemberRowProps) {
  const t = useTranslations("members");
  const tCommon = useTranslations("common");

  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const dirty = selectedRole !== initialRole;

  const [roleState, roleAction] = useActionState<RoleChangeResult | undefined, FormData>(
    updateMemberRoleAction,
    undefined,
  );

  const roleErrorKey = roleState?.error;

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-sm font-medium">{name}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{email}</td>
      <td className="px-4 py-3">
        {isAdmin && !isSelf ? (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="membershipId" value={membershipId} />
            <select
              name="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="OWNER">{t("roleOwner")}</option>
              <option value="ADMIN">{t("roleAdmin")}</option>
              <option value="OPERATOR">{t("roleOperator")}</option>
              <option value="VIEWER">{t("roleViewer")}</option>
            </select>
            {dirty ? (
              <SubmitButton size="sm" pendingLabel="...">
                {tCommon("save")}
              </SubmitButton>
            ) : null}
            {roleErrorKey === "LAST_OWNER" ? (
              <span className="text-xs text-red-600">{t("errLastOwner")}</span>
            ) : null}
            {roleErrorKey === "CANNOT_TOUCH_SELF" ? (
              <span className="text-xs text-red-600">{t("errCannotTouchSelf")}</span>
            ) : null}
          </form>
        ) : (
          <Badge variant={ROLE_VARIANTS[initialRole] ?? "muted"}>
            {t(`role${initialRole.charAt(0) + initialRole.slice(1).toLowerCase()}`)}
            {isSelf ? ` (${t("you")})` : ""}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isAdmin && !isSelf ? (
          <>
            {showRemoveConfirm ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="text-red-600">{t("removeConfirm")}</span>
                <form action={removeMemberAction} className="inline">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="membershipId" value={membershipId} />
                  <button
                    type="submit"
                    className="rounded-md bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                  >
                    {tCommon("delete")}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  className="rounded-md border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
                >
                  {tCommon("cancel")}
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(true)}
                className="text-sm text-red-600 hover:underline"
              >
                {t("removeMember")}
              </button>
            )}
          </>
        ) : null}
      </td>
    </tr>
  );
}
