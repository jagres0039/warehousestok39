# Spesifikasi Aplikasi Pencatatan Gudang (SaaS)

> **Codename sementara:** *Gudangin* (bisa diganti)
> **Tipe:** Multi-tenant SaaS (jasa sewa aplikasi)
> **Target user per tenant:** 1–5 orang
> **Skala data:** Ribuan SKU, ratusan transaksi/hari per tenant

---

## 1. Arsitektur Tingkat Tinggi

Karena niatnya **jasa sewa aplikasi**, kita pakai arsitektur **multi-tenant** dari awal — satu aplikasi melayani banyak perusahaan, data diisolasi per `organizationId`. Lebih hemat hosting & gampang maintain dibanding deploy instance terpisah per klien.

```
[ Browser (PC/HP) ]
        |
        v
[ Next.js (Vercel-style, di VPS) ]  <-- frontend + API routes
        |
        v
[ PostgreSQL (di VPS) ]  <-- semua tenant, isolasi via organizationId
        |
        v
[ Daily backup → S3 / VPS lain ]
```

### Stack final
| Layer | Pilihan |
|---|---|
| Frontend + Backend | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | NextAuth v5 (credentials provider, JWT session) |
| i18n | next-intl (ID + EN, switcher di pojok kanan atas) |
| Barcode scan | html5-qrcode (pakai kamera HP) |
| PDF export | @react-pdf/renderer |
| Excel export | exceljs |
| Hosting | Docker Compose di VPS user |
| Reverse proxy + HTTPS | Caddy (auto-SSL Let's Encrypt) |
| CI/CD | GitHub Actions → deploy via SSH ke VPS |
| Backup | Cron job `pg_dump` harian |

---

## 2. Konsep Multi-Tenant

### Entitas inti
- **Organization** = 1 perusahaan klien yang nyewa aplikasi.
- **User** = orang yang login. Bisa anggota >1 Organization (jarang, tapi support-able).
- **Membership** = relasi User ↔ Organization, sekaligus simpan **role** (`OWNER`, `ADMIN`, `OPERATOR`, `VIEWER`).
- Semua data transaksi & master (Item, Supplier, Customer, dll) **wajib punya `organizationId`** dan setiap query difilter otomatis di middleware.

### Role & Hak Akses (MVP)
| Role | Hak akses |
|---|---|
| OWNER | Semua + atur billing & hapus organization |
| ADMIN | Semua kecuali billing |
| OPERATOR | Buat & edit transaksi keluar/masuk, lihat stok |
| VIEWER | Hanya lihat (stok + laporan) |

### Onboarding flow
1. User register → otomatis bikin **Organization** baru, dia jadi OWNER.
2. Isi profil perusahaan (nama, alamat, NPWP, logo, mata uang, timezone).
3. Atur format penomoran dokumen (lihat §5).
4. Atur bahasa default (ID/EN).
5. Invite anggota tim via email (kalau email service belum siap, pakai kode invite).

---

## 3. Fitur MVP (Fase 1)

### 3.1 Master Data
- **Item / Barang**
  - Field: kode (unik per org, auto-generate optional), nama, deskripsi, kategori, satuan (pcs/box/kg/dll), barcode, lokasi rak, stok minimum, foto (optional).
  - Multi-satuan konversi (mis. 1 box = 12 pcs) → **Fase 2**, MVP cukup 1 satuan dulu.
- **Kategori Item** (hierarki sederhana, 1 level)
- **Satuan** (master, default sudah ada: pcs, box, kg, liter, dll)
- **Supplier** (nama, kontak, alamat, NPWP)
- **Customer / Tujuan keluar** (nama, kontak, alamat) — bisa juga "internal use" / "produksi"
- **Gudang/Lokasi** — MVP cukup 1 gudang default, multi-gudang di Fase 2

### 3.2 Transaksi
- **Barang Masuk (Goods Receipt)**
  - Header: nomor (auto sesuai format), tanggal, supplier, catatan, attachment foto surat jalan (optional)
  - Detail (multi-line): item, qty, harga beli (optional), batch/lot (optional), expired date (optional untuk barang FMCG/food)
  - Saat di-*post* → stok bertambah & kartu stok ter-update
  - Status: DRAFT, POSTED, VOID

- **Barang Keluar (Goods Issue)**
  - Header: nomor, tanggal, tujuan (customer/internal), catatan
  - Detail: item, qty
  - Validasi stok cukup (warning kalau minus, blokir kalau strict mode)
  - Saat di-*post* → stok berkurang

- **Penyesuaian Stok (Adjustment)** — untuk koreksi cepat, alasan wajib diisi.

### 3.3 Stok & Laporan
- **Daftar Stok Real-time** (filter kategori, search, low-stock indicator)
- **Kartu Stok per Item** (semua mutasi: tanggal, jenis, qty, saldo)
- **Laporan Mutasi** per periode (filter item, kategori, jenis transaksi)
- **Laporan Low Stock** (di bawah stok minimum)
- **Export Excel & PDF** semua laporan

### 3.4 Barcode/QR
- Generate QR per item (download / print label)
- Scan via kamera HP saat input transaksi → otomatis ke-add ke baris

### 3.5 Settings
- Profil perusahaan (nama, alamat, logo, NPWP, mata uang, timezone)
- Format penomoran (lihat §5)
- Bahasa default
- User & Role management (invite, ubah role, nonaktifkan)

---

## 4. Fitur Fase 2 (setelah MVP stabil)
- **Purchase Order (PO)** ke supplier → approve → terima sebagian/penuh → otomatis bikin GRN
- **Sales Order / Delivery Order** + **Faktur/Invoice** dengan nomor seri, cetak PDF, watermark logo
- **Stock Opname** (cycle count: list barang → input qty fisik → generate selisih → adjustment)
- **Multi-gudang / Multi-lokasi** + transfer antar gudang
- **Multi-satuan & konversi**
- **Dashboard** (grafik mutasi, top fast/slow moving, nilai stok)
- **Audit log** (siapa, kapan, ubah apa)

## 5. Format Penomoran Dokumen (Customizable per Tenant)

Tenant bisa atur sendiri lewat Settings → Document Numbering. Format pakai **template string** dengan placeholder:

| Placeholder | Arti | Contoh |
|---|---|---|
| `{PREFIX}` | Prefix kustom | `BM`, `GR`, `MASUK` |
| `{YYYY}` | Tahun 4-digit | `2025` |
| `{YY}` | Tahun 2-digit | `25` |
| `{MM}` | Bulan 2-digit | `11` |
| `{DD}` | Tanggal 2-digit | `24` |
| `{SEQ:N}` | Counter zero-padded N digit | `{SEQ:4}` → `0001` |
| `{ORG}` | Kode singkat organisasi | `ACME` |

**Contoh template:**
- Barang Masuk: `BM-{YYYY}{MM}-{SEQ:4}` → `BM-202511-0001`
- Barang Keluar: `BK/{YY}/{MM}/{SEQ:5}` → `BK/25/11/00001`
- Adjustment: `ADJ-{YYYY}-{SEQ:3}` → `ADJ-2025-001`

**Counter reset policy** (pilih per dokumen type):
- Tidak pernah reset
- Reset tiap tahun
- Reset tiap bulan

**Cara user mengubahnya (akan ada di UI Settings):**
1. Login → Settings → Document Numbering
2. Pilih jenis dokumen (Barang Masuk / Keluar / Adjustment / dst.)
3. Edit template string (live preview di samping)
4. Pilih reset policy
5. Save

Sistem validasi: nomor yang sudah pernah dipakai gak bisa dipakai lagi (unique per org + doc type).

---

## 6. Internasionalisasi (i18n)

- **Bahasa didukung:** Bahasa Indonesia (default), English.
- File terjemahan: `messages/id.json`, `messages/en.json`.
- Switcher bahasa di header (icon globe).
- Pilihan bahasa disimpan per **user** (preferensi), fallback ke default org.
- Format tanggal & angka mengikuti locale (`Intl.DateTimeFormat`, `Intl.NumberFormat`).
- Mata uang ditentukan per organization (IDR default).

---

## 7. Skema Database (ER Diagram dalam bentuk teks)

```
Organization (id, name, slug, address, npwp, logoUrl, currency, timezone,
              defaultLocale, createdAt)
   |
   |-- Membership (id, userId, organizationId, role)
   |        |
   |        +-- User (id, email, name, passwordHash, locale, createdAt)
   |
   |-- DocNumberConfig (id, orgId, docType, template, resetPolicy, currentCounter, counterPeriod)
   |
   |-- Category (id, orgId, name, parentId)
   |
   |-- Unit (id, orgId, code, name)   // pcs, box, kg, etc.
   |
   |-- Item (id, orgId, code, name, description, categoryId, unitId, barcode,
   |         location, minStock, photoUrl, isActive, createdAt)
   |        |
   |        +-- StockLedger (id, orgId, itemId, date, refType, refId,
   |                          qtyIn, qtyOut, balance, note)
   |
   |-- Supplier (id, orgId, name, contact, phone, email, address, npwp)
   |
   |-- Customer (id, orgId, name, contact, phone, email, address)
   |
   |-- Warehouse (id, orgId, name, address)  // MVP: 1 default
   |
   |-- GoodsReceipt (id, orgId, number, date, supplierId, warehouseId, note,
   |                  status, createdById, postedAt)
   |        +-- GoodsReceiptLine (id, grId, itemId, qty, unitPrice, batch, expiredAt)
   |
   |-- GoodsIssue (id, orgId, number, date, customerId, warehouseId, note,
   |                status, createdById, postedAt)
   |        +-- GoodsIssueLine (id, giId, itemId, qty)
   |
   |-- StockAdjustment (id, orgId, number, date, itemId, qtyDelta, reason,
                         createdById)
```

**Indexes penting:** `(orgId, code)` unik di Item, Supplier, Customer; `(orgId, number)` unik per doc type; `(orgId, itemId, date)` untuk StockLedger.

**Tenant isolation:** Semua query Prisma wajib lewat middleware yang inject `where: { orgId: ctx.orgId }`. Gua bikin helper `db(orgId)` biar gak ada yang ke-skip.

---

## 8. Keamanan & Operasional

- Password hash: **argon2id**
- Rate limit login: 5 percobaan / 15 menit per IP+email
- Session: JWT signed, expire 7 hari, refresh on activity
- HTTPS wajib via Caddy auto-SSL
- Backup harian PostgreSQL → file terenkripsi → di-copy ke storage terpisah
- Log audit (Fase 2)
- `.env` di VPS, tidak pernah commit secrets

---

## 9. Roadmap Implementasi MVP

| Sprint | Durasi est. | Output |
|---|---|---|
| **1. Foundation** | — | Repo, Next.js setup, Prisma schema, Docker, Caddy, deploy skeleton ke VPS |
| **2. Auth & Tenancy** | — | Register, login, bikin org otomatis, middleware tenant, role guard |
| **3. Master Data** | — | CRUD Item, Category, Unit, Supplier, Customer, Warehouse |
| **4. Transaksi Inti** | — | Goods Receipt + Goods Issue + Stock Ledger + Adjustment |
| **5. Laporan & Export** | — | Daftar stok, kartu stok, mutasi, low-stock, export Excel/PDF |
| **6. Barcode & Settings** | — | QR generator, scan via kamera, doc numbering UI, profil org, i18n |
| **7. Polish & Launch** | — | Bug fixing, seed data demo, dokumentasi user, deploy production |

Sprint dikerjain berurutan, tiap sprint = 1 PR. Lu bisa review tiap PR sebelum lanjut.

---

## 10. Yang Gua Butuhin dari Lu Sebelum Mulai Coding

1. **Nama repo GitHub** — usulan: `gudangin` atau `warehouse-saas`. Mau yang mana?
2. **Repo private atau public?** (saran: private, karena nanti jadi produk komersial)
3. **IP VPS deploy** — bisa dikasih nanti pas sprint 1 mau deploy, gak harus sekarang.
4. **Approval** untuk plan ini. Kalau ada yang mau diubah/ditambah, kasih tau sebelum gua mulai.

Begitu lu approve, gua mulai Sprint 1 (foundation + skeleton deploy) dan langsung bikin PR pertama.
