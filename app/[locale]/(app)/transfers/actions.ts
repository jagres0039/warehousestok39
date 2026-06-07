"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { prisma } from "@/lib/prisma";
import {
  postStockTransfer,
  cancelStockTransfer,
  InsufficientStockError,
  SameWarehouseTransferError,
} from "@/lib/inventory";
import {
  transferHeaderSchema,
  transferLineSchema,
  cancelSchema,
  type ActionResult,
} from "@/lib/transaction-schemas";

function parseLines(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createStockTransferAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create stock transfer");

  const headerRaw = {
    fromWarehouseId: String(formData.get("fromWarehouseId") ?? ""),
    toWarehouseId: String(formData.get("toWarehouseId") ?? ""),
    occurredAt: String(formData.get("occurredAt") ?? ""),
    note: String(formData.get("note") ?? "") || null,
  };
  const header = transferHeaderSchema.safeParse(headerRaw);
  if (!header.success) {
    const fields = header.error.flatten().fieldErrors as Record<string, string[]>;
    if (fields.toWarehouseId?.length) {
      return { ok: false, error: "SAME_WAREHOUSE", fieldErrors: fields };
    }
    return { ok: false, fieldErrors: fields };
  }

  const linesRaw = parseLines(String(formData.get("lines") ?? "[]"));
  if (linesRaw.length === 0) return { ok: false, error: "EMPTY_LINES" };
  const parsedLines = linesRaw.map((l) => transferLineSchema.safeParse(l));
  const failed = parsedLines.find((r) => !r.success);
  if (failed && !failed.success) {
    return { ok: false, error: "INVALID_QTY" };
  }
  const lines = parsedLines
    .filter((r): r is { success: true; data: { itemId: string; qty: number; note?: string | null } } => r.success)
    .map((r) => r.data);

  const [fromWh, toWh, items] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: header.data.fromWarehouseId, organizationId: session.organizationId, isActive: true },
    }),
    prisma.warehouse.findFirst({
      where: { id: header.data.toWarehouseId, organizationId: session.organizationId, isActive: true },
    }),
    prisma.item.findMany({
      where: {
        organizationId: session.organizationId,
        id: { in: lines.map((l) => l.itemId) },
        isActive: true,
      },
      select: { id: true },
    }),
  ]);
  if (!fromWh || !toWh) return { ok: false, error: "INVALID_REF" };
  const validItems = new Set(items.map((i) => i.id));
  for (const line of lines) {
    if (!validItems.has(line.itemId)) return { ok: false, error: "INVALID_REF" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { slug: true },
  });
  if (!org) return { ok: false, error: "INVALID_REF" };

  try {
    await postStockTransfer({
      organizationId: session.organizationId,
      orgSlug: org.slug,
      createdById: session.userId,
      fromWarehouseId: header.data.fromWarehouseId,
      toWarehouseId: header.data.toWarehouseId,
      occurredAt: new Date(header.data.occurredAt),
      note: header.data.note ?? undefined,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        qty: l.qty,
        note: l.note ?? undefined,
      })),
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "INSUFFICIENT_STOCK" };
    }
    if (err instanceof SameWarehouseTransferError) {
      return { ok: false, error: "SAME_WAREHOUSE" };
    }
    if (err instanceof Error && err.message === "INVALID_QTY") {
      return { ok: false, error: "INVALID_QTY" };
    }
    if (err instanceof Error && err.message === "EMPTY_LINES") {
      return { ok: false, error: "EMPTY_LINES" };
    }
    throw err;
  }

  revalidatePath(`/${locale}/transfers`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/transfers`);
}

export async function cancelStockTransferAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "cancel stock transfer");
  const parsed = cancelSchema.safeParse({ reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) {
    return { ok: false, error: "REASON_REQUIRED" };
  }
  try {
    await cancelStockTransfer(id, {
      organizationId: session.organizationId,
      canceledById: session.userId,
      reason: parsed.data.reason,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return { ok: false, error: "NOT_FOUND" };
      if (err.message === "ALREADY_CANCELED")
        return { ok: false, error: "ALREADY_CANCELED" };
    }
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "INSUFFICIENT_STOCK" };
    }
    throw err;
  }
  revalidatePath(`/${locale}/transfers`);
  revalidatePath(`/${locale}/transfers/${id}`);
  return { ok: true };
}
