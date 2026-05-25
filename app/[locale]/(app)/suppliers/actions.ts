"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { createPartner, updatePartner } from "@/lib/partner-service";
import type { ActionResult } from "@/lib/master-data-schemas";

export async function createSupplierAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create supplier");
  const result = await createPartner("supplier", session.organizationId, formData);
  if (!result.ok) return result;
  revalidatePath(`/${locale}/suppliers`);
  redirect(`/${locale}/suppliers`);
}

export async function updateSupplierAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "update supplier");
  const result = await updatePartner("supplier", session.organizationId, id, formData);
  if (!result.ok) return result;
  revalidatePath(`/${locale}/suppliers`);
  redirect(`/${locale}/suppliers`);
}
