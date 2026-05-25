"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { assertCanMutate } from "@/lib/role-guard";
import { createPartner, updatePartner } from "@/lib/partner-service";
import type { ActionResult } from "@/lib/master-data-schemas";

export async function createCustomerAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "create customer");
  const result = await createPartner("customer", session.organizationId, formData);
  if (!result.ok) return result;
  revalidatePath(`/${locale}/customers`);
  redirect(`/${locale}/customers`);
}

export async function updateCustomerAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanMutate(session.role, "update customer");
  const result = await updatePartner("customer", session.organizationId, id, formData);
  if (!result.ok) return result;
  revalidatePath(`/${locale}/customers`);
  redirect(`/${locale}/customers`);
}
