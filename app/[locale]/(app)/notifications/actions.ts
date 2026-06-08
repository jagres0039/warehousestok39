"use server";

import { revalidatePath } from "next/cache";
import { requireTenantSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { runStockAlertCheck } from "@/lib/notifications";
import { assertCanAdminister } from "@/lib/role-guard";

export async function markNotificationReadAction(
  notificationId: string,
  locale: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireTenantSession(locale);
  // Scope by org so a user can't read another tenant's row.
  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      organizationId: session.organizationId,
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath(`/${locale}`, "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction(
  locale: string,
): Promise<{ ok: true }> {
  const session = await requireTenantSession(locale);
  await prisma.notification.updateMany({
    where: {
      organizationId: session.organizationId,
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath(`/${locale}`, "layout");
  return { ok: true };
}

// Manual "Check now" trigger from the dashboard. Restricted to OWNER/ADMIN.
export async function runStockAlertCheckAction(
  locale: string,
): Promise<{
  ok: true;
  alertsCreated: number;
  alertsResolved: number;
  alertsTotalToday: number;
}> {
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "run stock alert check");
  const summary = await runStockAlertCheck(session.organizationId, {
    triggerSource: "manual",
    triggeredById: session.userId,
  });
  revalidatePath(`/${locale}`, "layout");
  return {
    ok: true,
    alertsCreated: summary.alertsCreated,
    alertsResolved: summary.alertsResolved,
    alertsTotalToday: summary.alertsTotalToday,
  };
}
