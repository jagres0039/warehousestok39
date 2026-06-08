import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  runStockAlertCheck,
  runStockAlertCheckForAllOrgs,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST  /api/internal/cron/check-stock-alerts
//
// Two callers are supported:
//
//  1. **Cron / external scheduler** — provides the shared secret via the
//     `Authorization: Bearer <CRON_SECRET>` header. Runs the check for every
//     organisation. Use this from vercel-cron, k8s CronJob, GitHub Actions,
//     etc. If `CRON_SECRET` is unset, this path is disabled.
//
//  2. **Authenticated OWNER/ADMIN** clicking the "Check now" button in the
//     dashboard. Runs the check for the caller's own organisation only and
//     records the trigger source as "manual".
//
// Idempotency is provided by the underlying notification service (one row per
// (org, type, item, batch, dateBucket)), so re-running this endpoint within
// the same UTC day will not create duplicate notifications.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const summaries = await runStockAlertCheckForAllOrgs({
      triggerSource: "cron",
    });
    return NextResponse.json({ ok: true, runs: summaries });
  }

  // Authenticated path — use the user's session.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Resolve the caller's active org + role. The `auth()` payload already
  // includes the active org but we re-check the role server-side to gate
  // OWNER/ADMIN only.
  const sessionOrg = session.activeOrganizationId;
  if (!sessionOrg) {
    return NextResponse.json({ error: "NO_ORG" }, { status: 400 });
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: sessionOrg } },
    select: { role: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const summary = await runStockAlertCheck(sessionOrg, {
    triggerSource: "manual",
    triggeredById: userId,
  });
  return NextResponse.json({ ok: true, summary });
}

// Convenience GET handler so cURL pings show usage info; real triggers must
// use POST + Bearer auth.
export async function GET() {
  return NextResponse.json({
    ok: true,
    usage:
      "POST with Authorization: Bearer <CRON_SECRET> for cron, or POST while authenticated as OWNER/ADMIN.",
  });
}
