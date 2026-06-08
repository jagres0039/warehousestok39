// Sprint 12 — alert generation pipeline.
//
// `runStockAlertCheck()` scans all active items in an organisation and emits
// (or resolves) two kinds of in-app notifications:
//
//  - LOW_STOCK:      total on-hand across warehouses < item.minStock
//  - EXPIRING_SOON:  any active batch with expiryDate within `expiringDays`
//
// Idempotency key: (organizationId, type, itemId, batchId, dateBucket) where
// `dateBucket` = YYYY-MM-DD of the run. Re-running the same day upserts the
// existing row instead of creating duplicates. Conditions that disappear
// (stock recovers, batch consumed) flip `isResolved` true on existing rows
// for the same dateBucket but earlier rows remain for audit.
//
// Email digest is sent once per organisation per run via `sendAlertDigestEmail`
// (mocked — logs to console). Real Resend wires in by replacing lib/email.ts.

import { prisma } from "@/lib/prisma";
import { getStockOnHand, getStockOnHandPerBatch } from "@/lib/inventory";
import { sendAlertDigestEmail } from "@/lib/email";

export interface RunOptions {
  // How many days ahead to flag as "expiring soon". Default 30.
  expiringDays?: number;
  // Override "now" in tests.
  now?: Date;
  // Identifier for AlertCheckRun — "cron", "manual", "test", etc.
  triggerSource?: string;
  triggeredById?: string | null;
}

export interface RunSummary {
  runId: string;
  organizationId: string;
  itemsScanned: number;
  batchesScanned: number;
  alertsCreated: number;
  alertsResolved: number;
  // Total notifications matching today's dateBucket after the run, including
  // pre-existing un-touched rows. Useful for the "Check now" button to show
  // a result count.
  alertsTotalToday: number;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDateBucket(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function daysBetween(a: Date, b: Date): number {
  // Floor of (b - a) in whole days; sign preserved.
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export async function runStockAlertCheck(
  organizationId: string,
  opts: RunOptions = {},
): Promise<RunSummary> {
  const now = opts.now ?? new Date();
  const expiringDays = opts.expiringDays ?? 30;
  const dateBucket = toDateBucket(now);

  // Open the audit row early so partial failures still leave a trail.
  const run = await prisma.alertCheckRun.create({
    data: {
      organizationId,
      triggerSource: opts.triggerSource ?? "cron",
      triggeredById: opts.triggeredById ?? null,
    },
  });

  let itemsScanned = 0;
  let batchesScanned = 0;
  let alertsCreated = 0;
  let alertsResolved = 0;
  const newAlertsPreview: Array<{ title: string; body: string }> = [];

  try {
    // --- Low stock ------------------------------------------------------
    const items = await prisma.item.findMany({
      where: { organizationId, isActive: true, minStock: { gt: 0 } },
      select: {
        id: true,
        sku: true,
        name: true,
        minStock: true,
        unit: { select: { code: true } },
      },
    });
    itemsScanned = items.length;

    if (items.length > 0) {
      const onHand = await getStockOnHand(organizationId);
      // Sum across warehouses → per-item total. Could be split per warehouse
      // later; for now aggregate is the simpler heuristic.
      const totalByItem = new Map<string, number>();
      for (const row of onHand) {
        totalByItem.set(row.itemId, (totalByItem.get(row.itemId) ?? 0) + row.qty);
      }

      for (const item of items) {
        const total = totalByItem.get(item.id) ?? 0;
        const min = Number(item.minStock);
        const isLow = total < min;
        const shortage = Math.max(0, min - total);
        if (isLow) {
          const title = `Low stock: ${item.sku}`;
          const body = `${item.name} on-hand ${total} ${item.unit.code} (min ${min}, short ${shortage}).`;
          // Prisma v5 disallows `null` in compound unique upsert keys, so we
          // emulate upsert with findFirst + create/update.
          const existing = await prisma.notification.findFirst({
            where: {
              organizationId,
              type: "LOW_STOCK",
              itemId: item.id,
              batchId: null,
              dateBucket,
            },
            select: { id: true },
          });
          if (existing) {
            await prisma.notification.update({
              where: { id: existing.id },
              data: {
                title,
                body,
                metricValue: shortage,
                severity: shortage >= min ? "CRITICAL" : "WARNING",
                isResolved: false,
                resolvedAt: null,
              },
            });
          } else {
            await prisma.notification.create({
              data: {
                organizationId,
                type: "LOW_STOCK",
                itemId: item.id,
                batchId: null,
                dateBucket,
                title,
                body,
                metricValue: shortage,
                severity: shortage >= min ? "CRITICAL" : "WARNING",
              },
            });
            alertsCreated += 1;
            if (newAlertsPreview.length < 5) newAlertsPreview.push({ title, body });
          }
        } else {
          // Resolve any open low-stock alert for this item today.
          const updated = await prisma.notification.updateMany({
            where: {
              organizationId,
              type: "LOW_STOCK",
              itemId: item.id,
              batchId: null,
              dateBucket,
              isResolved: false,
            },
            data: { isResolved: true, resolvedAt: now },
          });
          alertsResolved += updated.count;
        }
      }
    }

    // --- Expiring batches ----------------------------------------------
    const horizon = new Date(now.getTime() + expiringDays * 24 * 60 * 60 * 1000);
    const batches = await prisma.itemBatch.findMany({
      where: {
        organizationId,
        isActive: true,
        expiryDate: { not: null, lte: horizon },
      },
      select: {
        id: true,
        batchCode: true,
        expiryDate: true,
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: { select: { code: true } },
          },
        },
      },
    });
    batchesScanned = batches.length;

    if (batches.length > 0) {
      const perBatchOnHand = await getStockOnHandPerBatch(organizationId);
      const onHandByBatch = new Map<string, number>();
      for (const r of perBatchOnHand) {
        if (!r.batchId) continue;
        onHandByBatch.set(r.batchId, (onHandByBatch.get(r.batchId) ?? 0) + r.qty);
      }
      for (const b of batches) {
        const remaining = onHandByBatch.get(b.id) ?? 0;
        if (remaining <= 0) continue; // nothing left, no point alerting.
        const expiry = b.expiryDate as Date; // null filtered out by query
        const days = daysBetween(now, expiry);
        const isExpired = days < 0;
        const type = isExpired ? "EXPIRED" : "EXPIRING_SOON";
        const title = isExpired
          ? `Expired: ${b.item.sku} batch ${b.batchCode}`
          : `Expiring in ${days}d: ${b.item.sku} batch ${b.batchCode}`;
        const body = `${b.item.name} batch ${b.batchCode} expires ${expiry.toISOString().slice(0, 10)} · ${remaining} ${b.item.unit.code} left.`;
        const upserted = await prisma.notification.upsert({
          where: {
            organizationId_type_itemId_batchId_dateBucket: {
              organizationId,
              type,
              itemId: b.item.id,
              batchId: b.id,
              dateBucket,
            },
          },
          update: {
            title,
            body,
            metricValue: days,
            severity: isExpired ? "CRITICAL" : days <= 7 ? "WARNING" : "INFO",
            isResolved: false,
            resolvedAt: null,
          },
          create: {
            organizationId,
            type,
            itemId: b.item.id,
            batchId: b.id,
            dateBucket,
            title,
            body,
            metricValue: days,
            severity: isExpired ? "CRITICAL" : days <= 7 ? "WARNING" : "INFO",
          },
          select: { createdAt: true, updatedAt: true },
        });
        if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
          alertsCreated += 1;
          if (newAlertsPreview.length < 5) newAlertsPreview.push({ title, body });
        }
      }
    }

    // Email digest. We send only if there's at least one new alert today
    // so admins don't get an empty heartbeat email every run.
    if (alertsCreated > 0) {
      const recipients = await prisma.user.findMany({
        where: {
          memberships: {
            some: {
              organizationId,
              role: { in: ["OWNER", "ADMIN"] },
            },
          },
        },
        select: { email: true },
      });
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      if (recipients.length > 0 && org) {
        await sendAlertDigestEmail({
          to: recipients.map((r) => r.email),
          organizationName: org.name,
          alertCount: alertsCreated,
          preview: newAlertsPreview,
        });
      }
    }

    const totalToday = await prisma.notification.count({
      where: { organizationId, dateBucket, isResolved: false },
    });

    await prisma.alertCheckRun.update({
      where: { id: run.id },
      data: {
        finishedAt: now,
        itemsScanned,
        batchesScanned,
        alertsCreated,
        alertsResolved,
      },
    });

    return {
      runId: run.id,
      organizationId,
      itemsScanned,
      batchesScanned,
      alertsCreated,
      alertsResolved,
      alertsTotalToday: totalToday,
    };
  } catch (err) {
    await prisma.alertCheckRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

// Run the check across every organisation. Used by the cron endpoint.
export async function runStockAlertCheckForAllOrgs(
  opts: RunOptions = {},
): Promise<RunSummary[]> {
  const orgs = await prisma.organization.findMany({
    select: { id: true },
  });
  const results: RunSummary[] = [];
  for (const o of orgs) {
    results.push(await runStockAlertCheck(o.id, opts));
  }
  return results;
}
