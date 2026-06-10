# Deploy ke Vercel + Neon (PostgreSQL)

Panduan deploy **warehousestok39** ke [Vercel](https://vercel.com) dengan database PostgreSQL gratis dari [Neon](https://neon.tech). Cocok buat ngecek & nge-test app secara online tanpa harus nyiapin server sendiri.

> Catatan: app ini full-stack (Next.js server actions + Prisma + NextAuth + PostgreSQL). Jadi **gak bisa** di GitHub Pages (statis doang). Vercel + Neon adalah cara paling gampang buat hosting beneran.

---

## Ringkasan alur

1. Bikin database di Neon, ambil 2 connection string (pooled + direct).
2. Dari laptop, jalanin migrasi + seed ke Neon.
3. Import repo ke Vercel.
4. Set environment variables di Vercel.
5. Deploy & login pakai akun seed.

---

## 1. Bikin database di Neon

1. Daftar / login di https://neon.tech (bisa pakai akun GitHub).
2. Klik **New Project** -> kasih nama (mis. `warehousestok39`) -> pilih region terdekat (mis. Singapore / `ap-southeast-1`).
3. Setelah jadi, buka **Connection Details / Connect**. Kamu butuh DUA bentuk connection string:
   - **Pooled** (ada kata `-pooler` di host) -> dipakai Vercel saat runtime.
   - **Direct** (tanpa `-pooler`) -> dipakai buat migrasi & seed dari laptop.

Contoh bentuknya:

```
# POOLED (buat Vercel / DATABASE_URL)
postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1

# DIRECT (buat migrate & seed dari lokal)
postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

> Tips: parameter `pgbouncer=true&connection_limit=1` penting di URL pooled biar Prisma aman jalan di environment serverless Vercel.

---

## 2. Jalanin migrasi + seed ke Neon (dari laptop)

Kenapa dari laptop? Karena Prisma di repo ini cuma pakai satu `DATABASE_URL` (belum ada `directUrl`), jadi migrasi paling aman dijalanin manual lewat koneksi **direct**, bukan pas build di Vercel.

```bash
# pakai connection string DIRECT (tanpa -pooler)
export DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

npm install
npx prisma migrate deploy   # bikin semua tabel
npx prisma db seed          # isi data demo + batch
```

Kalau sukses, database Neon kamu udah berisi schema lengkap + data demo (item, batch, gudang, supplier, dll).

**Akun login hasil seed:**

| Field    | Value                     |
| -------- | ------------------------- |
| Email    | `devin-tester@example.com`|
| Password | `Passw0rd!23`             |

---

## 3. Import repo ke Vercel

1. Login di https://vercel.com pakai akun GitHub.
2. **Add New... -> Project** -> pilih repo `jagres0039/warehousestok39` -> **Import**.
3. Framework otomatis kedeteksi **Next.js**. Build command udah diatur lewat `vercel.json` (`prisma generate && next build`), jadi gak perlu diubah.
4. JANGAN klik Deploy dulu sebelum set environment variables (step 4).

---

## 4. Environment variables di Vercel

Di halaman import (atau **Settings -> Environment Variables**), tambahin:

| Name              | Value                                                | Catatan                                        |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`    | connection string **POOLED** dari Neon               | yang ada `-pooler` + `pgbouncer=true`          |
| `AUTH_SECRET`     | hasil `openssl rand -base64 32`                      | wajib buat NextAuth v5                          |
| `AUTH_TRUST_HOST` | `true`                                               | biar session aman di balik domain Vercel        |
| `CRON_SECRET`     | hasil `openssl rand -base64 32`                      | buat endpoint cek stok terjadwal (opsional)     |
| `APP_URL`         | URL produksi Vercel (mis. `https://xxx.vercel.app`)  | bisa diisi setelah tau domain-nya               |
| `NODE_ENV`        | (otomatis `production` di Vercel)                    | gak usah di-set manual                          |

> `AUTH_URL` biasanya gak perlu di-set, NextAuth v5 auto-detect dari domain Vercel. Set manual cuma kalau ada masalah callback.

Cara generate secret (di terminal):

```bash
openssl rand -base64 32
```

---

## 5. Deploy & login

1. Klik **Deploy**, tunggu build selesai (~2-3 menit).
2. Buka URL `*.vercel.app` yang dikasih Vercel.
3. Login pakai akun seed di atas.
4. Cek halaman: dashboard, items, batches, transaksi (receipt/issue/transfer), opname, notifikasi.

Kalau habis tau domain finalnya, balik ke env vars, update `APP_URL` ke domain itu, terus **Redeploy**.

---

## 6. (Opsional) Scheduled stock alerts

Endpoint cron ada di `app/api/internal/cron/check-stock-alerts` dan nerima **POST** dengan header `Authorization: Bearer <CRON_SECRET>`.

- **Pilihan A (udah disiapin):** GitHub Actions workflow (`.github/workflows/stock-alerts-cron.yml`) yang manggil endpoint tiap hari. Tinggal isi secret `APP_URL` + `CRON_SECRET` di repo Settings -> Secrets.
- **Pilihan B (Vercel Cron):** Vercel Cron ngirim request **GET**, sedangkan endpoint ini butuh POST. Jadi kalau mau pakai Vercel Cron, perlu nambah handler GET dulu di route-nya. Bisa diurus nanti kalau perlu.

Kalau cuma buat ngetes manual, tombol **"Check now"** di app (buat OWNER/ADMIN) udah cukup, gak butuh cron sama sekali.

---

## 7. Troubleshooting

- **Error `Can't reach database server` / timeout saat runtime:** pastikan `DATABASE_URL` di Vercel pakai URL **pooled** (`-pooler`) + `pgbouncer=true&connection_limit=1`.
- **Error Prisma `prepared statement already exists`:** sama, ini gejala lupa `pgbouncer=true` di URL pooled.
- **Tabel kosong / error relasi:** migrasi/seed belum jalan. Ulangi step 2 pakai URL **direct**.
- **Login gagal / redirect loop:** cek `AUTH_SECRET` udah di-set dan `AUTH_TRUST_HOST=true`.
- **Build gagal di Prisma:** `vercel.json` udah maksa `prisma generate` jalan pas build; pastikan file itu ada di root repo.
