"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/session";
import { assertCanAdminister } from "@/lib/role-guard";
import { readFormData, type ActionResult } from "@/lib/master-data-schemas";
import { organizationSchema } from "@/lib/settings-schemas";

export async function updateOrganizationAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const locale = String(formData.get("locale") ?? "id");
  const session = await requireTenantSession(locale);
  assertCanAdminister(session.role, "update organization");

  const raw = readFormData(formData);
  if (typeof raw.name === "string") raw.name = raw.name.trim();
  if (typeof raw.address === "string") raw.address = raw.address.trim();
  if (typeof raw.npwp === "string") raw.npwp = raw.npwp.trim();
  if (typeof raw.logoUrl === "string") raw.logoUrl = raw.logoUrl.trim();
  if (typeof raw.currency === "string") raw.currency = raw.currency.trim().toUpperCase();
  if (typeof raw.timezone === "string") raw.timezone = raw.timezone.trim();

  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      name: parsed.data.name,
      address: parsed.data.address?.length ? parsed.data.address : null,
      npwp: parsed.data.npwp?.length ? parsed.data.npwp : null,
      logoUrl: parsed.data.logoUrl?.length ? parsed.data.logoUrl : null,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      defaultLocale: parsed.data.defaultLocale,
    },
  });

  revalidatePath(`/${locale}/settings/organization`);
  return { ok: true };
}
