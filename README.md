# warehousestok39

Multi-tenant SaaS warehouse inventory management for SMEs / UMKM.

> Aplikasi pencatatan keluar-masuk barang gudang yang siap disewakan ke banyak perusahaan. Tiap perusahaan mengelola data, pengguna, format dokumen, dan bahasanya sendiri.

[![CI](https://github.com/jagres0039/warehousestok39/actions/workflows/ci.yml/badge.svg)](https://github.com/jagres0039/warehousestok39/actions/workflows/ci.yml)

## Fitur (MVP)

- **Multi-tenant** dengan isolasi total per-organization, role-based access (OWNER / ADMIN / OPERATOR / VIEWER)
- **Master data**: Item, Kategori, Satuan, Supplier, Customer, Gudang — semua tenant-scoped, soft-deletable
- **Transaksi**: Barang Masuk, Barang Keluar, Penyesuaian Stok — dengan validasi stok minus, cancel + reversal otomatis
- **Stok ledger append-only** sebagai single source of truth (audit-friendly)
- **Laporan**: stok real-time, kartu stok per item, mutasi periode, low-stock; export Excel + PDF
- **Penomoran dokumen** customizable per tenant (template `{YYYY}{MM}-{SEQ:4}` dll., reset policy never/yearly/monthly)
- **QR label printable** per item (PDF dengan QR + nama org + SKU)
- **Pengaturan tenant**: profil organisasi (nama, alamat, NPWP, logo, currency, timezone), bahasa default
- **i18n**: Bahasa Indonesia (default) + English

## Dokumentasi

- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — panduan pengguna (login, master data, transaksi, laporan, settings, QR label)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploy ke VPS (Docker + Caddy) atau Vercel + managed Postgres
- [`docs/SPEC.md`](docs/SPEC.md) — spesifikasi lengkap arsitektur & roadmap

## Tech stack

- **Framework:** [Next.js 15](https://nextjs.org) (App Router) + TypeScript
- **UI:** Tailwind CSS, shadcn-style primitives
- **Database:** PostgreSQL 16 + [Prisma](https://prisma.io)
- **Auth:** [NextAuth v5](https://authjs.dev) (credentials, JWT session)
- **i18n:** [next-intl](https://next-intl.dev) (id + en)
- **PDF:** [@react-pdf/renderer](https://react-pdf.org) — QR labels & laporan
- **Excel:** [exceljs](https://github.com/exceljs/exceljs)
- **Barcode:** [qrcode](https://github.com/soldair/node-qrcode)
- **Deploy:** Docker Compose + Caddy (auto-SSL) di VPS, atau Vercel + managed Postgres

## Local development

### Prerequisites

- Node.js 22+ (lihat `engines.node` di `package.json`)
- Docker & Docker Compose (untuk Postgres lokal)
- npm 10+

### Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env

# 3. Start Postgres (Docker)
docker compose up -d db

# 4. Run migrations
npx prisma migrate deploy

# 5. (Optional) Seed demo tenant + sample data
npx prisma db seed
#   Login bawaan: devin-tester@example.com / Passw0rd!23
#   Tenant: "Warehousestok39 Demo" (slug: warehousestok39-demo)

# 6. Run dev server
npm run dev
```

Buka <http://localhost:3000>. Default locale **id** (Indonesian); ganti ke English lewat link locale di header atau buka `/en`.

### Demo tenant yang di-seed

`npx prisma db seed` mengisi tenant demo dengan data realistis (idempotent, aman dijalankan ulang):

- **Tenant:** Warehousestok39 Demo (Asia/Jakarta, IDR)
- **OWNER:** `devin-tester@example.com` / `Passw0rd!23`
- **Master data:** 4 kategori, 5 satuan, 3 supplier, 3 customer, 2 gudang, 10 item (Elektronik, Sembako, ATK, Kemasan)
- **Transaksi:** 3 barang masuk, 2 barang keluar, 1 adjustment — supaya dashboard & laporan langsung ada isinya

> Untuk production: **JANGAN** jalankan seed di environment customer, atau hapus akun demo segera sesudahnya (`docs/DEPLOYMENT.md` §4).

### Scripts berguna

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server Next.js |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | TypeScript no-emit check |
| `npm run prisma:seed` | Run seed demo data |
| `npx prisma studio` | DB GUI |
| `npx prisma migrate dev` | Bikin + apply migration dev baru |
| `npx prisma migrate deploy` | Apply migration production |

## Production deploy

Lihat [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) untuk panduan lengkap. Ringkasnya:

- **Docker Compose + Caddy** di VPS (1 perintah `docker compose up -d --build`), atau
- **Vercel + Neon/Supabase** (import repo, set env vars, klik Deploy)

## Repository layout

```
app/                     # Next.js App Router
  [locale]/              # localized routes (id, en)
    (auth)/              # public auth pages (login, register)
    (app)/               # authenticated app shell + features
      dashboard/
      items/
      categories/
      units/
      suppliers/
      customers/
      warehouses/
      goods-receipts/
      goods-issues/
      adjustments/
      reports/
      settings/
        organization/
        document-numbering/
  api/
    health/route.ts          # health-check endpoint
    print/                   # PDF endpoints (item-label, gr, gi, adj)
components/                  # UI primitives
lib/
  prisma.ts                  # Prisma client singleton
  auth.ts                    # NextAuth config
  session.ts, role-guard.ts  # tenant + role helpers
  doc-numbering.ts           # template engine (pure)
  doc-numbering-service.ts   # transactional counter
  inventory.ts               # posting + reversal service
  settings-schemas.ts        # zod schemas for settings forms
messages/
  id.json
  en.json
prisma/
  schema.prisma              # data model
  seed.ts                    # demo tenant + sample data
  migrations/
docs/
  USER_GUIDE.md
  DEPLOYMENT.md
  SPEC.md
Dockerfile                   # multi-stage, Next standalone
docker-compose.yml           # db + app + caddy
Caddyfile                    # reverse proxy + auto-SSL
.github/workflows/ci.yml     # lint + typecheck + build on PRs
```

## Roadmap

Lihat [`docs/SPEC.md`](docs/SPEC.md) untuk detail. High-level:

1. **Sprint 1 — Foundation:** scaffolding, schema skeleton, Docker, CI. ✓
2. **Sprint 2 — Auth & tenancy:** register/login, org onboarding, role-based access. ✓
3. **Sprint 3 — Master data:** items, categories, units, suppliers, customers, warehouses. ✓
4. **Sprint 4 — Transactions:** goods receipt, goods issue, stock adjustment, stock ledger. ✓
5. **Sprint 5 — Reports & export:** stock list, stock card, mutation report, Excel/PDF export. ✓
6. **Sprint 6 — Barcode & settings:** QR labels, document numbering UI, org profile, locale switcher. ✓
7. **Sprint 7 — Polish & launch:** seed/demo data, user docs, production deploy. ✓ (you are here)

Fase 2 (di luar MVP): Purchase Order/Sales Order, Invoice, scan kamera HP, user/role management UI, multi-gudang transfer, dashboard grafik, audit log.

## License

Proprietary. All rights reserved.
