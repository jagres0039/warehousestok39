// Demo data seed for the "Warehousestok39 Demo" tenant.
//
// Idempotent: safe to re-run any number of times. Master data is upserted by
// its per-tenant unique code/slug. Sample transactions are created only when
// the tenant has zero goods-receipt records (so we don't keep stacking ledger
// movements every time the seed runs).
//
// Run from package.json (`prisma.seed`) or directly:
//   npx prisma db seed

import { PrismaClient, type DocType, type Prisma } from "@prisma/client";
import { hashPassword } from "../lib/password";
import {
  postGoodsReceipt,
  postGoodsIssue,
  postStockAdjustment,
} from "../lib/inventory";

const prisma = new PrismaClient();

const ORG_SLUG = "warehousestok39-demo";
const ORG_NAME = "Warehousestok39 Demo";
const OWNER_EMAIL = "devin-tester@example.com";
const OWNER_NAME = "Devin Tester";
const OWNER_PASSWORD = "Passw0rd!23";

const DEFAULT_DOC_TEMPLATES: Array<{ docType: DocType; template: string }> = [
  { docType: "GOODS_RECEIPT", template: "GR-{YYYY}{MM}-{SEQ:4}" },
  { docType: "GOODS_ISSUE", template: "GI-{YYYY}{MM}-{SEQ:4}" },
  { docType: "STOCK_ADJUSTMENT", template: "ADJ-{YYYY}-{SEQ:4}" },
  { docType: "STOCK_TRANSFER", template: "TRF-{YYYY}{MM}-{SEQ:4}" },
  { docType: "STOCK_OPNAME", template: "OPN-{YYYY}{MM}-{SEQ:4}" },
  { docType: "PURCHASE_ORDER", template: "PO-{YYYY}{MM}-{SEQ:4}" },
  { docType: "SALES_ORDER", template: "SO-{YYYY}{MM}-{SEQ:4}" },
  { docType: "INVOICE", template: "INV-{YYYY}{MM}-{SEQ:5}" },
];

const CATEGORIES = [
  { slug: "elektronik", name: "Elektronik", description: "Perangkat elektronik & aksesoris" },
  { slug: "sembako", name: "Sembako", description: "Kebutuhan pokok harian" },
  { slug: "alat-tulis", name: "Alat Tulis", description: "Perlengkapan kantor & sekolah" },
  { slug: "kemasan", name: "Kemasan", description: "Box, kardus, plastik packing" },
];

const UNITS = [
  { code: "PCS", name: "Pieces" },
  { code: "BOX", name: "Box" },
  { code: "KG", name: "Kilogram" },
  { code: "L", name: "Liter" },
  { code: "M", name: "Meter" },
];

const SUPPLIERS = [
  {
    code: "SUP-001",
    name: "PT Sumber Elektronik",
    contactName: "Andi Wijaya",
    phone: "021-555-0101",
    email: "sales@sumberelektronik.example",
    address: "Jl. Mangga Dua Raya No. 12, Jakarta Pusat",
  },
  {
    code: "SUP-002",
    name: "CV Sembako Jaya",
    contactName: "Ibu Sri",
    phone: "0812-3456-7890",
    email: "order@sembakojaya.example",
    address: "Pasar Induk Kramat Jati Blok B-5, Jakarta Timur",
  },
  {
    code: "SUP-003",
    name: "Toko ATK Bersama",
    contactName: "Pak Hari",
    phone: "022-444-2020",
    email: "info@atkbersama.example",
    address: "Jl. Asia Afrika No. 88, Bandung",
  },
];

const CUSTOMERS = [
  {
    code: "CUST-001",
    name: "Toko Maju Mundur",
    contactName: "Pak Joko",
    phone: "0813-1111-2222",
    email: "joko@majumundur.example",
    address: "Jl. Sudirman No. 17, Bekasi",
  },
  {
    code: "CUST-002",
    name: "Warung Bu Sri",
    contactName: "Bu Sri",
    phone: "0856-7777-8888",
    email: null,
    address: "Jl. Melati Gang 3 No. 4, Depok",
  },
  {
    code: "CUST-003",
    name: "Kantor Pak Budi",
    contactName: "Budi Santoso",
    phone: "021-789-1234",
    email: "admin@budisantoso.example",
    address: "Menara BCA Lt. 12, Jakarta Pusat",
  },
];

const WAREHOUSES = [
  {
    code: "WH-MAIN",
    name: "Gudang Utama",
    address: "Jl. Sudirman No. 39, Jakarta Pusat",
    isDefault: true,
  },
  {
    code: "WH-CABANG",
    name: "Gudang Cabang Bekasi",
    address: "Jl. Ahmad Yani No. 200, Bekasi",
    isDefault: false,
  },
];

interface SeedItem {
  sku: string;
  name: string;
  description?: string;
  categorySlug: string | null;
  unitCode: string;
  barcode?: string | null;
  minStock: number;
  tracksBatch?: boolean;
}

const ITEMS: SeedItem[] = [
  // Keep the existing test fixture so tests that target WST-DEMO-001 keep passing.
  {
    sku: "WST-DEMO-001",
    name: "Sample Demo Item",
    description: "Item demo bawaan untuk pengujian QR label.",
    categorySlug: null,
    unitCode: "PCS",
    minStock: 0,
  },
  {
    sku: "ELK-001",
    name: "Mouse Wireless Logitech M170",
    categorySlug: "elektronik",
    unitCode: "PCS",
    barcode: "8901234500011",
    minStock: 5,
  },
  {
    sku: "ELK-002",
    name: "Keyboard Mechanical Outemu Blue",
    categorySlug: "elektronik",
    unitCode: "PCS",
    barcode: "8901234500028",
    minStock: 3,
  },
  {
    sku: "ELK-003",
    name: "Kabel HDMI 2 meter",
    categorySlug: "elektronik",
    unitCode: "PCS",
    barcode: "8901234500035",
    minStock: 10,
  },
  {
    sku: "SMB-001",
    name: "Beras Premium 5 kg",
    categorySlug: "sembako",
    unitCode: "BOX",
    barcode: "8991234500015",
    minStock: 20,
    tracksBatch: true,
  },
  {
    sku: "SMB-002",
    name: "Minyak Goreng 2 L",
    categorySlug: "sembako",
    unitCode: "BOX",
    barcode: "8991234500022",
    minStock: 30,
    tracksBatch: true,
  },
  {
    sku: "SMB-003",
    name: "Gula Pasir 1 kg",
    categorySlug: "sembako",
    unitCode: "KG",
    barcode: "8991234500039",
    minStock: 50,
    tracksBatch: true,
  },
  {
    sku: "ATK-001",
    name: "Pulpen Pilot G2 (1 lusin)",
    categorySlug: "alat-tulis",
    unitCode: "BOX",
    barcode: "8771234500011",
    minStock: 10,
  },
  {
    sku: "ATK-002",
    name: "Buku Tulis 100 lembar",
    categorySlug: "alat-tulis",
    unitCode: "PCS",
    barcode: "8771234500028",
    minStock: 50,
  },
  {
    sku: "KMS-001",
    name: "Kardus Sedang 30x20x15 cm",
    categorySlug: "kemasan",
    unitCode: "PCS",
    minStock: 100,
  },
];

// Batch/lot demo data for the tracksBatch items above. Expiry windows are
// chosen to exercise every batch status: healthy, expiring soon (<= 30 days),
// and already expired.
interface SeedBatch {
  itemSku: string;
  batchCode: string;
  mfgDaysAgo: number;
  expiryDaysFromNow: number;
  note?: string;
}

const ITEM_BATCHES: SeedBatch[] = [
  // Beras: one lot expiring soon, one already expired.
  { itemSku: "SMB-001", batchCode: "BRS-2406A", mfgDaysAgo: 60, expiryDaysFromNow: 15, note: "Lot mau kadaluarsa" },
  { itemSku: "SMB-001", batchCode: "BRS-2405B", mfgDaysAgo: 120, expiryDaysFromNow: -2, note: "Lot sudah kadaluarsa" },
  // Minyak goreng: one expiring soon, one healthy.
  { itemSku: "SMB-002", batchCode: "MGR-2406", mfgDaysAgo: 30, expiryDaysFromNow: 20 },
  { itemSku: "SMB-002", batchCode: "MGR-2407", mfgDaysAgo: 10, expiryDaysFromNow: 200 },
  // Gula: single healthy lot.
  { itemSku: "SMB-003", batchCode: "GLA-2406", mfgDaysAgo: 40, expiryDaysFromNow: 90 },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

async function main(): Promise<void> {
  console.log(`Seeding tenant "${ORG_NAME}" (${ORG_SLUG})…`);

  // --- Tenant + OWNER user -------------------------------------------------
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: ORG_NAME },
    create: {
      slug: ORG_SLUG,
      name: ORG_NAME,
      address: "Jl. Sudirman No. 39, Jakarta Pusat",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      defaultLocale: "id",
    },
  });

  const passwordHash = await hashPassword(OWNER_PASSWORD);
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { name: OWNER_NAME, passwordHash, locale: "id" },
    create: {
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      passwordHash,
      locale: "id",
    },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, organizationId: org.id, role: "OWNER" },
  });

  // --- Document numbering defaults (only seeded if missing) ----------------
  for (const cfg of DEFAULT_DOC_TEMPLATES) {
    await prisma.docNumberConfig.upsert({
      where: {
        organizationId_docType: { organizationId: org.id, docType: cfg.docType },
      },
      // Don't overwrite tenant customizations; only fill in the row if absent.
      update: {},
      create: {
        organizationId: org.id,
        docType: cfg.docType,
        template: cfg.template,
      },
    });
  }

  // --- Master data ---------------------------------------------------------
  const categoryByslug = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: c.slug } },
      update: { name: c.name, description: c.description, isActive: true },
      create: {
        organizationId: org.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
      },
    });
    categoryByslug.set(c.slug, row.id);
  }

  const unitByCode = new Map<string, string>();
  for (const u of UNITS) {
    const row = await prisma.unit.upsert({
      where: { organizationId_code: { organizationId: org.id, code: u.code } },
      update: { name: u.name, isActive: true },
      create: { organizationId: org.id, code: u.code, name: u.name },
    });
    unitByCode.set(u.code, row.id);
  }

  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { organizationId_code: { organizationId: org.id, code: s.code } },
      update: {
        name: s.name,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        address: s.address,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        code: s.code,
        name: s.name,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        address: s.address,
      },
    });
  }

  const customerByCode = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const row = await prisma.customer.upsert({
      where: { organizationId_code: { organizationId: org.id, code: c.code } },
      update: {
        name: c.name,
        contactName: c.contactName,
        phone: c.phone,
        email: c.email,
        address: c.address,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        code: c.code,
        name: c.name,
        contactName: c.contactName,
        phone: c.phone,
        email: c.email,
        address: c.address,
      },
    });
    customerByCode.set(c.code, row.id);
  }

  const warehouseByCode = new Map<string, string>();
  for (const w of WAREHOUSES) {
    const row = await prisma.warehouse.upsert({
      where: { organizationId_code: { organizationId: org.id, code: w.code } },
      update: {
        name: w.name,
        address: w.address,
        isDefault: w.isDefault,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        code: w.code,
        name: w.name,
        address: w.address,
        isDefault: w.isDefault,
      },
    });
    warehouseByCode.set(w.code, row.id);
  }

  const itemBySku = new Map<string, string>();
  for (const i of ITEMS) {
    const unitId = unitByCode.get(i.unitCode);
    if (!unitId) throw new Error(`Unit ${i.unitCode} missing while seeding item ${i.sku}`);
    const categoryId = i.categorySlug ? categoryByslug.get(i.categorySlug) ?? null : null;
    const data: Prisma.ItemUncheckedCreateInput = {
      organizationId: org.id,
      sku: i.sku,
      name: i.name,
      description: i.description ?? null,
      categoryId,
      unitId,
      barcode: i.barcode ?? null,
      minStock: i.minStock,
      tracksBatch: i.tracksBatch ?? false,
      isActive: true,
    };
    const row = await prisma.item.upsert({
      where: { organizationId_sku: { organizationId: org.id, sku: i.sku } },
      update: {
        name: i.name,
        description: i.description ?? null,
        categoryId,
        unitId,
        barcode: i.barcode ?? null,
        minStock: i.minStock,
        tracksBatch: i.tracksBatch ?? false,
        isActive: true,
      },
      create: data,
    });
    itemBySku.set(i.sku, row.id);
  }

  // --- Batch / lot demo data (tracksBatch items) --------------------------
  // Idempotent without relying on the compound-unique key name: look the row
  // up by (org, item, batchCode) and update-or-create.
  const batchIdByCode = new Map<string, string>();
  for (const b of ITEM_BATCHES) {
    const itemId = itemBySku.get(b.itemSku);
    if (!itemId) throw new Error(`Item ${b.itemSku} missing while seeding batch ${b.batchCode}`);
    const mfgDate = daysAgo(b.mfgDaysAgo);
    const expiryDate = daysFromNow(b.expiryDaysFromNow);
    const existing = await prisma.itemBatch.findFirst({
      where: { organizationId: org.id, itemId, batchCode: b.batchCode },
      select: { id: true },
    });
    if (existing) {
      await prisma.itemBatch.update({
        where: { id: existing.id },
        data: { mfgDate, expiryDate, note: b.note ?? null, isActive: true },
      });
      batchIdByCode.set(b.batchCode, existing.id);
    } else {
      const created = await prisma.itemBatch.create({
        data: {
          organizationId: org.id,
          itemId,
          batchCode: b.batchCode,
          mfgDate,
          expiryDate,
          note: b.note ?? null,
          isActive: true,
        },
        select: { id: true },
      });
      batchIdByCode.set(b.batchCode, created.id);
    }
  }
  console.log(`Seeded ${ITEM_BATCHES.length} item batches.`);

  // --- Sample transactions (only when none yet) ---------------------------
  const existingReceipts = await prisma.goodsReceipt.count({
    where: { organizationId: org.id },
  });

  if (existingReceipts > 0) {
    console.log(
      `Sample transactions already exist (${existingReceipts} goods receipts); skipping.`,
    );
  } else {
    const mainWarehouseId = warehouseByCode.get("WH-MAIN")!;
    const cabangWarehouseId = warehouseByCode.get("WH-CABANG")!;
    const supplierElektronik = await prisma.supplier.findUnique({
      where: { organizationId_code: { organizationId: org.id, code: "SUP-001" } },
    });
    const supplierSembako = await prisma.supplier.findUnique({
      where: { organizationId_code: { organizationId: org.id, code: "SUP-002" } },
    });

    // 1) Initial restock 7 days ago — populates stock so the dashboard is alive.
    await postGoodsReceipt({
      organizationId: org.id,
      orgSlug: org.slug,
      createdById: owner.id,
      warehouseId: mainWarehouseId,
      supplierId: supplierElektronik?.id ?? null,
      occurredAt: daysAgo(7),
      note: "Restock awal dari PT Sumber Elektronik.",
      lines: [
        { itemId: itemBySku.get("ELK-001")!, qty: 25 },
        { itemId: itemBySku.get("ELK-002")!, qty: 12 },
        { itemId: itemBySku.get("ELK-003")!, qty: 40 },
      ],
    });

    // 2) Sembako restock 5 days ago — batch-tracked lots.
    await postGoodsReceipt({
      organizationId: org.id,
      orgSlug: org.slug,
      createdById: owner.id,
      warehouseId: mainWarehouseId,
      supplierId: supplierSembako?.id ?? null,
      occurredAt: daysAgo(5),
      note: "Restock sembako mingguan (per lot).",
      lines: [
        { itemId: itemBySku.get("SMB-001")!, batchId: batchIdByCode.get("BRS-2406A")!, qty: 40 },
        { itemId: itemBySku.get("SMB-001")!, batchId: batchIdByCode.get("BRS-2405B")!, qty: 20 },
        { itemId: itemBySku.get("SMB-002")!, batchId: batchIdByCode.get("MGR-2406")!, qty: 30 },
        { itemId: itemBySku.get("SMB-002")!, batchId: batchIdByCode.get("MGR-2407")!, qty: 50 },
        { itemId: itemBySku.get("SMB-003")!, batchId: batchIdByCode.get("GLA-2406")!, qty: 120 },
      ],
    });

    // 3) ATK + packing 3 days ago, to the cabang warehouse.
    await postGoodsReceipt({
      organizationId: org.id,
      orgSlug: org.slug,
      createdById: owner.id,
      warehouseId: cabangWarehouseId,
      supplierId: null,
      occurredAt: daysAgo(3),
      note: "Pindah stok ATK ke cabang Bekasi (titipan supplier).",
      lines: [
        { itemId: itemBySku.get("ATK-001")!, qty: 30 },
        { itemId: itemBySku.get("ATK-002")!, qty: 150 },
        { itemId: itemBySku.get("KMS-001")!, qty: 250 },
      ],
    });

    // 4) Outbound — customer pickup 2 days ago (issues from a tracked lot).
    await postGoodsIssue({
      organizationId: org.id,
      orgSlug: org.slug,
      createdById: owner.id,
      warehouseId: mainWarehouseId,
      customerId: customerByCode.get("CUST-001") ?? null,
      occurredAt: daysAgo(2),
      note: "Pengiriman ke Toko Maju Mundur.",
      lines: [
        { itemId: itemBySku.get("ELK-001")!, qty: 4 },
        { itemId: itemBySku.get("ELK-003")!, qty: 10 },
        { itemId: itemBySku.get("SMB-002")!, batchId: batchIdByCode.get("MGR-2406")!, qty: 12 },
      ],
    });

    // 5) Outbound — internal use 1 day ago, no customer.
    await postGoodsIssue({
      organizationId: org.id,
      orgSlug: org.slug,
      createdById: owner.id,
      warehouseId: cabangWarehouseId,
      customerId: customerByCode.get("CUST-003") ?? null,
      occurredAt: daysAgo(1),
      note: "Pengiriman ATK ke Kantor Pak Budi.",
      lines: [
        { itemId: itemBySku.get("ATK-001")!, qty: 5 },
        { itemId: itemBySku.get("ATK-002")!, qty: 30 },
      ],
    });

    // 6) Stock-take adjustment yesterday — found 2 extra mouse units, 1 missing keyboard.
    await postStockAdjustment({
      organizationId: org.id,
      orgSlug: org.slug,
      createdById: owner.id,
      warehouseId: mainWarehouseId,
      occurredAt: daysAgo(1),
      reason: "Hasil stock opname mingguan.",
      lines: [
        { itemId: itemBySku.get("ELK-001")!, direction: "IN", qty: 2 },
        { itemId: itemBySku.get("ELK-002")!, direction: "OUT", qty: 1 },
      ],
    });

    console.log("Sample transactions seeded (3 receipts, 2 issues, 1 adjustment).");
  }

  console.log("Seed complete.");
  console.log(`  Login: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  console.log(`  Tenant slug: ${ORG_SLUG}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
