"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/lib/auth";
import { registerSchema } from "@/lib/zod-schemas";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

const DEFAULT_TEMPLATES = [
  { docType: "GOODS_RECEIPT" as const, template: "GR-{YYYY}{MM}-{SEQ:4}" },
  { docType: "GOODS_ISSUE" as const, template: "GI-{YYYY}{MM}-{SEQ:4}" },
  { docType: "STOCK_ADJUSTMENT" as const, template: "ADJ-{YYYY}-{SEQ:4}" },
  { docType: "PURCHASE_ORDER" as const, template: "PO-{YYYY}{MM}-{SEQ:4}" },
  { docType: "SALES_ORDER" as const, template: "SO-{YYYY}{MM}-{SEQ:4}" },
  { docType: "INVOICE" as const, template: "INV-{YYYY}{MM}-{SEQ:5}" },
];

export interface RegisterResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function registerAction(
  _prev: RegisterResult | undefined,
  formData: FormData,
): Promise<RegisterResult> {
  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
    organizationName: String(formData.get("organizationName") ?? "").trim(),
  };
  const locale = String(formData.get("locale") ?? "id");

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { ok: false, error: "EMAIL_TAKEN" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const baseSlug = slugify(parsed.data.organizationName);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : withRandomSuffix(baseSlug);
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.data.email,
            name: parsed.data.name,
            passwordHash,
            locale,
          },
        });
        const org = await tx.organization.create({
          data: {
            slug,
            name: parsed.data.organizationName,
            defaultLocale: locale,
          },
        });
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: "OWNER",
          },
        });
        await tx.docNumberConfig.createMany({
          data: DEFAULT_TEMPLATES.map((t) => ({
            organizationId: org.id,
            docType: t.docType,
            template: t.template,
          })),
        });
      });
      break;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        Array.isArray(err.meta?.target) &&
        (err.meta?.target as string[]).includes("slug")
      ) {
        continue;
      }
      throw err;
    }
  }

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect(`/${locale}/dashboard`);
}
