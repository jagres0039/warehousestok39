# Deployment Guide — Warehousestok39

Panduan deploy production untuk Warehousestok39. Ada dua jalur yang didukung:

1. **Docker Compose di VPS** (default; sudah ada `docker-compose.yml` + `Caddyfile`).
2. **Vercel + managed Postgres** (Neon / Supabase / RDS).

Pilih salah satu sesuai infrastruktur Anda.

---

## 1. Prasyarat umum

- Repo sudah di-clone di mesin target (VPS) atau ter-import ke Vercel.
- Domain custom yang sudah pointing ke VPS / Vercel.
- Database PostgreSQL 16 (managed atau self-host).
- Akses untuk men-generate `AUTH_SECRET` (`openssl rand -base64 32`).

### Environment variables wajib

| Variable | Contoh | Catatan |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` | Connection string Prisma. |
| `AUTH_SECRET` | (random base64, 32+ byte) | NextAuth JWT signing key. Wajib production. |
| `AUTH_TRUST_HOST` | `true` | Set saat di belakang reverse proxy. |
| `AUTH_URL` | `https://gudang.contoh.com` | Public URL. Optional di Vercel (auto-detect). |
| `DEFAULT_LOCALE` | `id` | Default `id`. |
| `SUPPORTED_LOCALES` | `id,en` | Daftar dipisah koma. |
| `NODE_ENV` | `production` | Selalu `production` di runtime live. |

**Untuk Docker Compose** tambahan:

| Variable | Contoh |
|---|---|
| `POSTGRES_USER` | `warehouse` |
| `POSTGRES_PASSWORD` | (string panjang, jangan default!) |
| `POSTGRES_DB` | `warehousestok39` |
| `PUBLIC_DOMAIN` | `gudang.contoh.com` |
| `ACME_EMAIL` | `ops@contoh.com` |

---

## 2. Opsi A — Docker Compose di VPS

Stack yang dijalankan:

- `db` — PostgreSQL 16 (volume `postgres-data`)
- `app` — Next.js standalone build dari `Dockerfile`
- `caddy` — reverse proxy + auto-SSL Let's Encrypt

### Langkah pertama (initial deploy)

```bash
# 1. SSH ke VPS, pastikan Docker + Docker Compose plugin terinstall
ssh deploy@gudang.contoh.com
docker --version && docker compose version

# 2. Clone repo
git clone https://github.com/<your-org>/warehousestok39.git
cd warehousestok39

# 3. Siapkan .env (jangan commit!)
cp .env.example .env
nano .env
#   - Ganti POSTGRES_PASSWORD jadi string panjang acak
#   - Set AUTH_SECRET hasil `openssl rand -base64 32`
#   - Set PUBLIC_DOMAIN ke domain Anda, mis. gudang.contoh.com
#   - Set ACME_EMAIL ke email Anda (untuk notifikasi Let's Encrypt)
#   - Set AUTH_URL=https://${PUBLIC_DOMAIN}

# 4. Pastikan A record DNS PUBLIC_DOMAIN sudah pointing ke IP VPS
dig +short gudang.contoh.com

# 5. Bring everything up
docker compose up -d --build

# 6. Tunggu Caddy issue cert (lihat log)
docker compose logs -f caddy

# 7. Jalankan migration & seed demo (opsional)
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed   # opsional; jangan di-jalankan di tenant production

# 8. Sehat?
curl https://gudang.contoh.com/api/health
```

> **Catatan tentang seed:** `prisma db seed` mengisi tenant demo
> ("Warehousestok39 Demo" + akun `devin-tester@example.com`). **Jangan
> dijalankan di environment yang akan dipakai customer**, atau hapus akun
> demo sebelum mengundang pengguna nyata.

### Update / redeploy

```bash
cd warehousestok39
git pull
docker compose up -d --build app
docker compose exec app npx prisma migrate deploy
```

### Backup & restore

Daily backup ke `/backups`:

```cron
0 3 * * * docker exec -t warehousestok39-db-1 \
  pg_dump -U warehouse warehousestok39 | gzip > /backups/wh-$(date +\%F).sql.gz
```

Restore:

```bash
gunzip -c /backups/wh-2026-05-27.sql.gz \
  | docker exec -i warehousestok39-db-1 psql -U warehouse warehousestok39
```

Sebelum restore besar, stop `app`: `docker compose stop app`.

### Caddy domain change

Kalau ganti domain, edit `Caddyfile`, `PUBLIC_DOMAIN`, dan `AUTH_URL` di `.env`, lalu:

```bash
docker compose restart caddy app
```

---

## 3. Opsi B — Vercel + Managed Postgres

Cocok kalau Anda lebih nyaman dengan platform managed daripada VPS.

### 3.1 Provision Postgres

Pilih salah satu provider:

- **[Neon](https://neon.tech)** — free tier untuk dev, autoscale di paid plan.
- **[Supabase](https://supabase.com)** — Postgres + storage; cukup pakai connection string.
- **AWS RDS / Google Cloud SQL** — kalau infrastruktur sudah ada.

Buat database baru bernama `warehousestok39`, copy connection string-nya (harus berbentuk `postgresql://...?sslmode=require` untuk Neon/Supabase).

### 3.2 Setup project di Vercel

1. Import repo dari GitHub di https://vercel.com/new.
2. Framework Preset: **Next.js** (auto-detected).
3. Build & Output Settings: **biarkan default** (Next.js standalone otomatis).
4. **Install Command:** `npm install` (default).
5. **Build Command:** `npm run build` (default).
6. Tambah Environment Variables:

   | Name | Value | Environment |
   |---|---|---|
   | `DATABASE_URL` | (connection string Postgres) | Production + Preview |
   | `AUTH_SECRET` | hasil `openssl rand -base64 32` | Production + Preview |
   | `AUTH_TRUST_HOST` | `true` | Production + Preview |
   | `DEFAULT_LOCALE` | `id` | Production + Preview |
   | `SUPPORTED_LOCALES` | `id,en` | Production + Preview |

7. Klik **Deploy**.

### 3.3 Migration di Vercel

Vercel build step otomatis menjalankan `prisma generate` (lihat `postinstall`). Untuk `migrate deploy`, pakai **Build Command override**:

```
npm install && npx prisma migrate deploy && npm run build
```

Atau jalankan migration manual via Vercel CLI sebelum deploy pertama:

```bash
npm install -g vercel
vercel link
vercel env pull .env.production
DATABASE_URL=$(grep '^DATABASE_URL' .env.production | cut -d'=' -f2- | tr -d '"') \
  npx prisma migrate deploy
```

### 3.4 Custom domain

Vercel → Project → Settings → Domains → Add. Setelah aktif, set `AUTH_URL=https://<custom-domain>` di env (atau biarkan auto-detect).

### 3.5 Seed demo data (opsional, hati-hati di production!)

```bash
DATABASE_URL=... npx prisma db seed
```

Cukup sekali. Untuk re-seed (tanpa duplikasi transaksi), seed sudah idempotent — aman dijalankan ulang.

---

## 4. Production hardening checklist

Setelah deploy berjalan:

- [ ] **Set strong `AUTH_SECRET`** (32+ random bytes). Jangan pakai value contoh.
- [ ] **Postgres password** acak panjang, tidak pernah default.
- [ ] **HTTPS-only**: Caddy auto-SSL (Opsi A) atau Vercel default (Opsi B). Tidak ada akses HTTP plain.
- [ ] **Backup harian** PostgreSQL ke storage di luar host (mis. S3, Backblaze).
- [ ] **Hapus akun demo** (`devin-tester@example.com`) sebelum onboarding customer pertama. Jalankan:
  ```sql
  DELETE FROM "User" WHERE email = 'devin-tester@example.com';
  -- Cascade akan hapus membership; tenant demo bisa dihapus terpisah:
  DELETE FROM "Organization" WHERE slug = 'warehousestok39-demo';
  ```
- [ ] **Health monitoring**: ping `/api/health` dari uptime monitor (UptimeRobot / Better Stack / cron + curl).
- [ ] **Log retention**: pastikan log container di-rotate (`docker compose` default 10 MB / 3 file). Untuk audit lebih lengkap, kirim ke log aggregator (Loki, Datadog).
- [ ] **Rate-limit**: NextAuth credentials provider tidak punya rate-limit bawaan. Pasang di Caddy / Vercel WAF / Cloudflare di depan.

---

## 5. Troubleshooting

### Build di Vercel gagal: "Cannot find module bcryptjs"
Pastikan `bcryptjs` di `dependencies` (bukan `devDependencies`) — sudah benar di repo. Cek file lock terbaru ikut di-commit.

### `prisma migrate deploy` error "P3009: migrate found failed migrations"
Salah satu migration sebelumnya gagal di tengah jalan. Restore DB dari backup, atau secara manual: rapikan tabel `_prisma_migrations`, hapus baris failed (`finished_at IS NULL`), retry.

### NextAuth: "Cannot determine canonical URL"
Set `AUTH_URL=https://yourdomain.com` di env. Pastikan `AUTH_TRUST_HOST=true` saat di belakang reverse proxy.

### Caddy stuck di "obtaining certificate"
Cek DNS pointing benar (`dig +short`), port 80 & 443 terbuka, dan `ACME_EMAIL` valid. Lihat log: `docker compose logs caddy`.

### Postgres koneksi habis di Vercel (Neon free tier)
Neon free tier punya batas concurrent connection. Aktifkan **pooled connection** di Neon dashboard dan gunakan URL pooler-nya (akhiran `-pooler.`) untuk `DATABASE_URL`. Untuk migration jalankan dari connection direct (non-pooler).

---

## 6. CI/CD

`.github/workflows/ci.yml` menjalankan lint + typecheck + build pada setiap PR. Untuk auto-deploy ke VPS:

- Tambahkan secret `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER` di repo settings.
- Tambah job deploy yang `ssh` ke VPS dan jalankan `git pull && docker compose up -d --build`.

Untuk Vercel, push ke `main` → otomatis trigger deploy production (tidak perlu setup tambahan).

---

## 7. Ringkasan: VPS vs Vercel

| Aspek | Docker Compose + VPS | Vercel + Managed Postgres |
|---|---|---|
| Setup awal | ~30 menit (sekali) | ~10 menit |
| Biaya kecil | VPS ~$5-10/bln | Free tier cukup untuk demo |
| Skala | Manual (resize VPS, scale-out kompleks) | Otomatis (Vercel + Neon autoscale) |
| Kontrol penuh | Ya (akses root, customize Caddy/nginx) | Terbatas (Vercel runtime) |
| Backup DB | Harus setup cron sendiri | Provider biasanya sudah otomatis |
| Best for | Internal use, satu klien besar, data sovereignty | SaaS multi-tenant publik |

Rekomendasi default: **Vercel + Neon** untuk awal, migrasi ke VPS kalau perlu kontrol/biaya yang predictable.
