# QA Checklist — Fitur Batch / Lot

Checklist manual untuk nguji end-to-end fitur batch/lot (Sprint 12): pelacakan
lot, FEFO issue, transfer, opname per batch, laporan expiring-soon, dan
notifikasi stok. Karena belum ada environment runtime otomatis, langkah ini
dijalankan manual di app yang jalan lokal (atau staging).

## 0. Prasyarat

- [ ] Database siap & migrasi terbaru ke-apply: `npx prisma migrate deploy`
- [ ] Seed data dijalankan: `npx prisma db seed`
- [ ] Login sebagai OWNER: `devin-tester@example.com` / `Passw0rd!23`
- [ ] Tenant aktif: **Warehousestok39 Demo**

> Seed otomatis bikin item batch-tracked **SMB-001 (Beras)**, **SMB-002
> (Minyak Goreng)**, **SMB-003 (Gula)** beserta lot-nya. Status lot sengaja
> dibikin variatif: ada yang sehat, mau kadaluarsa (≤ 30 hari), dan sudah
> kadaluarsa.

## 1. Data lot hasil seed (acuan verifikasi)

Buka **Items → SMB-001 → Batches**. Harusnya muncul:

| Item | Batch | Expiry | On-hand (WH-MAIN) | Status diharapkan |
| --- | --- | --- | --- | --- |
| SMB-001 Beras | BRS-2406A | +15 hari | 40 BOX | Mau kadaluarsa (kuning) |
| SMB-001 Beras | BRS-2405B | -2 hari | 20 BOX | Kadaluarsa (merah) |
| SMB-002 Minyak | MGR-2406 | +20 hari | 18 BOX | Mau kadaluarsa (kuning) |
| SMB-002 Minyak | MGR-2407 | +200 hari | 50 BOX | Aktif (hijau) |
| SMB-003 Gula | GLA-2406 | +90 hari | 120 KG | Aktif (hijau) |

- [ ] Semua baris & status muncul sesuai tabel
- [ ] Item non-batch (mis. ELK-001) → halaman Batches nampilin pesan "tidak dilacak per batch"

## 2. Aktifkan batch tracking di item baru

- [ ] Buat item baru, centang **Lacak per batch** → simpan
- [ ] Buka detail item → tombol/menu **Batches** muncul
- [ ] Item lama yang non-batch tetap normal (gak maksa input batch)

## 3. Goods Receipt dengan batch

- [ ] Buat **Goods Receipt** baru di WH-MAIN untuk SMB-001
- [ ] Saat pilih item batch-tracked, field **batch** wajib muncul
- [ ] Bisa pilih batch existing **atau** bikin batch baru (kode + tgl expiry)
- [ ] Submit → on-hand batch nambah di halaman Batches & stock card
- [ ] Coba submit item batch-tracked **tanpa** batch → ditolak/validasi jalan

## 4. Goods Issue — FEFO (First-Expired-First-Out)

- [ ] Buat **Goods Issue** SMB-001 di WH-MAIN
- [ ] Saran/urutan batch ngedahuluin yang paling cepat expired (BRS lalu …)
- [ ] Issue qty > on-hand batch → ditolak dengan error stok kurang
- [ ] Issue valid → on-hand batch berkurang sesuai
- [ ] Stock card item nampilin pergerakan ISSUE dengan referensi dokumen

## 5. Transfer antar gudang — batch terbawa

- [ ] Transfer SMB-002 dari WH-MAIN → WH-CABANG, pilih batch MGR-2407
- [ ] Di WH-CABANG, on-hand batch MGR-2407 muncul (identitas batch terjaga)
- [ ] On-hand batch di WH-MAIN berkurang sebanyak yang ditransfer
- [ ] Transfer ke gudang yang sama → ditolak

## 6. Stock Opname per batch

- [ ] Buat draft opname di WH-MAIN
- [ ] Item batch-tracked tampil **satu baris per batch** (systemQty ke-snapshot)
- [ ] Ubah countedQty salah satu batch → varians kehitung benar
- [ ] Posting opname → ledger nyesuaikin on-hand batch ke angka hitungan
- [ ] Batal opname (draft & posted) → status & stok balik konsisten

## 7. Laporan Expiring Soon

- [ ] Buka **Reports → Expiring Soon**
- [ ] BRS-2406A & MGR-2406 muncul (≤ 30 hari)
- [ ] BRS-2405B muncul sebagai sudah kadaluarsa
- [ ] Lot sehat (MGR-2407, GLA-2406) **tidak** muncul
- [ ] Filter rentang hari (kalau ada) berfungsi

## 8. Notifikasi stok

- [ ] Jalankan cek manual: tombol **Check now** di Dashboard (OWNER/ADMIN)
- [ ] Lonceng notifikasi nampilin EXPIRING_SOON utk BRS-2406A & MGR-2406
- [ ] Muncul EXPIRED utk BRS-2405B
- [ ] Muncul LOW_STOCK utk item di bawah minStock (kalau ada)
- [ ] Tandai notifikasi "sudah dibaca" → badge unread berkurang
- [ ] Jalanin ulang cek → **tidak** ada notifikasi dobel (idempoten per hari)

## 9. Cron endpoint (setelah deploy)

- [ ] Set repo secret `APP_URL` + `CRON_SECRET` (Settings → Actions)
- [ ] Set env `CRON_SECRET` yang sama di server
- [ ] Trigger manual workflow **Stock alerts cron** (Run workflow) → sukses (HTTP 200)
- [ ] POST tanpa/ salah Bearer token → ditolak

## 10. Regresi singkat (non-batch tetap aman)

- [ ] Receipt/issue/adjustment item non-batch jalan seperti biasa
- [ ] Dashboard, daftar item, dan stock card item non-batch normal
- [ ] `npm run lint && npm run typecheck && npm run build` lulus (atau CI hijau)
