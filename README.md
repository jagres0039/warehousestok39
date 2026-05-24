# warehousestok39

Multi-tenant SaaS warehouse inventory management (PT/UMKM).

> Aplikasi pencatatan keluar-masuk barang gudang yang siap disewakan ke banyak perusahaan. Tiap perusahaan mengelola data, pengguna, format dokumen, dan bahasanya sendiri.

## Tech stack

- **Framework:** [Next.js 15](https://nextjs.org) (App Router) + TypeScript
- **UI:** Tailwind CSS, shadcn-style primitives
- **Database:** PostgreSQL 16 + [Prisma](https://prisma.io)
- **i18n:** [next-intl](https://next-intl.dev) (Bahasa Indonesia + English)
- **Auth:** NextAuth (added in Sprint 2)
- **Deploy:** Docker Compose + Caddy (auto-SSL) on a VPS

## Roadmap

The full plan lives in [`docs/SPEC.md`](docs/SPEC.md). High-level sprints:

1. **Sprint 1 — Foundation** _(current)_: scaffolding, schema skeleton, Docker, CI.
2. **Sprint 2 — Auth & tenancy**: register/login, organization onboarding, role-based access.
3. **Sprint 3 — Master data**: items, categories, units, suppliers, customers, warehouses.
4. **Sprint 4 — Transactions**: goods receipt, goods issue, stock adjustment, stock ledger.
5. **Sprint 5 — Reports & export**: stock list, stock card, mutation report, Excel/PDF export.
6. **Sprint 6 — Barcode & settings**: QR scan, document numbering UI, org profile, locale switcher.
7. **Sprint 7 — Polish & launch**: seed/demo data, user docs, production deploy.

## Local development

### Prerequisites

- Node.js 22+
- Docker & Docker Compose (for local Postgres)
- npm 10+

### Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and edit values
cp .env.example .env

# 3. Start Postgres (Docker)
docker compose up -d db

# 4. Run migrations (after Sprint 2 lands the first migration)
npx prisma migrate dev

# 5. Run the dev server
npm run dev
```

The app is available at <http://localhost:3000>. Default locale is **id** (Indonesian); switch to English with the locale link in the header or visit `/en`.

### Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (uses `output: "standalone"`) |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | TypeScript no-emit check |
| `npx prisma studio` | DB GUI |
| `npx prisma migrate dev` | Create + apply a dev migration |

## Production deploy (Docker Compose + Caddy)

The repo ships with a `docker-compose.yml` that runs three services:

- **`db`** — PostgreSQL 16
- **`app`** — Next.js standalone build (multi-stage `Dockerfile`)
- **`caddy`** — reverse proxy with automatic HTTPS via Let's Encrypt

### Steps on the VPS

```bash
# 1. Clone the repo
git clone https://github.com/jagres0039/warehousestok39.git
cd warehousestok39

# 2. Configure .env (point DNS A record of PUBLIC_DOMAIN at the VPS first)
cp .env.example .env
# Edit POSTGRES_PASSWORD, NEXTAUTH_SECRET, PUBLIC_DOMAIN, ACME_EMAIL.

# 3. Bring everything up
docker compose up -d --build

# 4. Verify
curl https://$PUBLIC_DOMAIN/api/health
```

Caddy issues and renews TLS certificates automatically using `ACME_EMAIL`. Postgres data persists in the `postgres-data` Docker volume.

### Backups

A simple daily backup cron on the host (configured separately):

```bash
0 3 * * * docker exec -t warehousestok39-db-1 \
  pg_dump -U warehouse warehousestok39 | gzip > /backups/wh-$(date +\%F).sql.gz
```

## Repository layout

```
app/                     # Next.js App Router
  [locale]/              # localized routes (id, en)
    layout.tsx
    page.tsx
    globals.css
  api/health/route.ts    # health-check endpoint
components/              # UI primitives
lib/
  prisma.ts              # Prisma client singleton
  tenancy.ts             # tenant context & role helpers
  doc-numbering.ts       # document-number template engine
  utils.ts
messages/                # next-intl translations
  id.json
  en.json
prisma/
  schema.prisma          # data model
docs/
  SPEC.md                # full product/architecture spec
Dockerfile               # multi-stage build, Next standalone
docker-compose.yml       # db + app + caddy
Caddyfile                # reverse proxy + auto-SSL
.github/workflows/ci.yml # lint + typecheck + build on PRs
```

## License

Proprietary. All rights reserved.
