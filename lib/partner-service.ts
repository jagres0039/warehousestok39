import { Prisma, type Supplier, type Customer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { partnerSchema, readFormData, type ActionResult } from "@/lib/master-data-schemas";

type PartnerKind = "supplier" | "customer";

function normalize(formData: FormData) {
  const raw = readFormData(formData, ["isActive"]);
  if (typeof raw.code === "string") raw.code = raw.code.trim().toUpperCase();
  for (const k of ["name", "contactName", "phone", "email", "address"]) {
    if (typeof raw[k] === "string") raw[k] = (raw[k] as string).trim();
  }
  return raw;
}

function mapError(err: unknown): ActionResult | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return { ok: false, error: "CODE_TAKEN" };
  }
  return null;
}

export async function createPartner(
  kind: PartnerKind,
  organizationId: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = normalize(formData);
  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const data = {
    organizationId,
    code: parsed.data.code,
    name: parsed.data.name,
    contactName: parsed.data.contactName?.length ? parsed.data.contactName : null,
    phone: parsed.data.phone?.length ? parsed.data.phone : null,
    email: parsed.data.email?.length ? parsed.data.email : null,
    address: parsed.data.address?.length ? parsed.data.address : null,
    isActive: parsed.data.isActive,
  };
  try {
    if (kind === "supplier") {
      await prisma.supplier.create({ data });
    } else {
      await prisma.customer.create({ data });
    }
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    throw err;
  }
  return { ok: true };
}

export async function updatePartner(
  kind: PartnerKind,
  organizationId: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = normalize(formData);
  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const data = {
    code: parsed.data.code,
    name: parsed.data.name,
    contactName: parsed.data.contactName?.length ? parsed.data.contactName : null,
    phone: parsed.data.phone?.length ? parsed.data.phone : null,
    email: parsed.data.email?.length ? parsed.data.email : null,
    address: parsed.data.address?.length ? parsed.data.address : null,
    isActive: parsed.data.isActive,
  };
  try {
    const where = { id, organizationId };
    const result =
      kind === "supplier"
        ? await prisma.supplier.updateMany({ where, data })
        : await prisma.customer.updateMany({ where, data });
    if (result.count === 0) {
      return { ok: false, error: "NOT_FOUND" };
    }
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return mapped;
    throw err;
  }
  return { ok: true };
}

export async function listPartners(
  kind: PartnerKind,
  organizationId: string,
  q: string,
  skip: number,
  take: number,
): Promise<{ rows: (Supplier | Customer)[]; total: number }> {
  const where = {
    organizationId,
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { contactName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const orderBy = [{ isActive: "desc" as const }, { code: "asc" as const }];
  if (kind === "supplier") {
    const [rows, total] = await Promise.all([
      prisma.supplier.findMany({ where, orderBy, skip, take }),
      prisma.supplier.count({ where }),
    ]);
    return { rows, total };
  }
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy, skip, take }),
    prisma.customer.count({ where }),
  ]);
  return { rows, total };
}

export async function findPartner(
  kind: PartnerKind,
  organizationId: string,
  id: string,
): Promise<Supplier | Customer | null> {
  const where = { id, organizationId };
  if (kind === "supplier") {
    return prisma.supplier.findFirst({ where });
  }
  return prisma.customer.findFirst({ where });
}
