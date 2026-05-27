"use server";

import { revalidatePath } from "next/cache";
import type { DocType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanAdminister } from "@/lib/role-guard";
import { readFormData, type ActionResult } from "@/lib/master-data-schemas";
import { docNumberConfigSchema } from "@/lib/settings-schemas";

const DOC_TYPES = [
  "GOODS_RECEIPT",
  "GOODS_ISSUE",
  "STOCK_ADJUSTMENT",
  "PURCHASE_ORDER",
  "SALES_ORDER",
  "INVOICE",
] as const satisfies readonly DocType[];

function isDocType(value: string): value is DocType {
  return (DOC_TYPES as readonly string[]).includes(value);
}

export async function updateDocNumberingAction(
  docType: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "update document numbering");

  if (!isDocType(docType)) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const raw = readFormData(formData);
  if (typeof raw.template === "string") raw.template = raw.template.trim();
  if (typeof raw.resetPolicy === "string") raw.resetPolicy = raw.resetPolicy.trim();

  const parsed = docNumberConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Use updateMany so we never accidentally touch another tenant's row even if
  // the URL is tampered with.
  const result = await prisma.docNumberConfig.updateMany({
    where: {
      organizationId: session.organizationId,
      docType,
    },
    data: {
      template: parsed.data.template,
      resetPolicy: parsed.data.resetPolicy,
    },
  });

  if (result.count === 0) {
    return { ok: false, error: "NOT_FOUND" };
  }

  revalidatePath(`/${locale}/settings/document-numbering`);
  revalidatePath(`/${locale}/settings/document-numbering/${docType}`);
  return { ok: true };
}
