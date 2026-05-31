import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireTenantSession } from "@/lib/session";
import { canAdminister } from "@/lib/role-guard";
import { listMembers } from "@/lib/members";
import { listPendingInvitations } from "@/lib/invitations";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteForm } from "./InviteForm";
import { MemberRow } from "./MemberRow";
import { revokeInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function MembersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireTenantSession(locale);
  const t = await getTranslations("members");
  const tCommon = await getTranslations("common");
  const isAdmin = canAdminister(session.role);

  const members = await listMembers(session.organizationId, session.userId);
  const invitations = isAdmin
    ? await listPendingInvitations(session.organizationId)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/settings`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; {tCommon("back")}
        </Link>
      </div>
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      {!isAdmin ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("adminOnlyNotice")}
        </p>
      ) : null}

      {/* Members table */}
      <div className="rounded-md border border-border bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("colName")}</th>
              <th className="px-4 py-3">{t("colEmail")}</th>
              <th className="px-4 py-3">{t("colRole")}</th>
              <th className="px-4 py-3 text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {members.map((m) => (
              <MemberRow
                key={m.membershipId}
                membershipId={m.membershipId}
                email={m.email}
                name={m.name}
                role={m.role}
                isSelf={m.isSelf}
                isAdmin={isAdmin}
                locale={locale}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invitations (admin only) */}
      {isAdmin && invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("pendingInvitations")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {invitations.map((inv) => {
                const expired = inv.expiresAt.getTime() < Date.now();
                return (
                  <div key={inv.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="font-medium">{inv.email}</span>
                    <Badge variant="muted">
                      {t(`role${inv.role.charAt(0) + inv.role.slice(1).toLowerCase()}`)}
                    </Badge>
                    {expired ? (
                      <span className="text-xs text-red-500">{t("expired")}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("expiresAt")}: {inv.expiresAt.toLocaleDateString()}
                      </span>
                    )}
                    {inv.invitedByName ? (
                      <span className="text-xs text-muted-foreground">
                        {t("invitedBy")}: {inv.invitedByName}
                      </span>
                    ) : null}
                    <form action={revokeInvitationAction} className="ml-auto">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline"
                      >
                        {t("revoke")}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Invite form (admin only) */}
      {isAdmin ? <InviteForm locale={locale} /> : null}
    </div>
  );
}
