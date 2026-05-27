# Panduan Pengguna — Warehousestok39

Panduan singkat alur kerja harian di Warehousestok39. Ditulis dari sudut pandang **OWNER / ADMIN**; OPERATOR dan VIEWER hanya bisa pakai bagian-bagian sesuai role-nya (lihat §1).

> Bahasa: dokumen ini di Bahasa Indonesia. UI mendukung Bahasa Indonesia (default) dan English; ubah lewat header pojok kanan atas atau di **Pengaturan → Profil Organisasi → Bahasa default**.

---

## 1. Konsep dasar

- **Organization (Tenant)**: satu perusahaan/cabang yang menyewa aplikasi. Data antar tenant **terisolasi total** — tidak ada cara melihat atau mengubah data tenant lain.
- **User**: orang yang login. Bisa menjadi anggota satu atau lebih organization, masing-masing dengan role tersendiri.
- **Role per organization**:

  | Role | Hak akses |
  |---|---|
  | **OWNER** | Akses penuh + atur user/role |
  | **ADMIN** | Akses penuh kecuali ganti billing |
  | **OPERATOR** | Buat & posting transaksi, lihat stok dan laporan |
  | **VIEWER** | Hanya melihat stok dan laporan, tidak bisa membuat/mengubah |

- **Stok Ledger**: setiap mutasi (masuk, keluar, penyesuaian) tercatat sebagai baris baru di buku besar stok yang **tidak pernah dihapus**. Pembatalan transaksi menulis baris pembalik, bukan menghapus baris lama. Saldo stok per item = SUM dari semua delta.

---

## 2. Login & Onboarding

### Akun demo (untuk percobaan lokal)

Setelah menjalankan `npx prisma db seed`, gunakan akun bawaan:

- **Email:** `devin-tester@example.com`
- **Password:** `Passw0rd!23`
- **Tenant:** Warehousestok39 Demo (slug `warehousestok39-demo`)
- **Role:** OWNER

### Register tenant baru

1. Buka `/{locale}/register` (mis. `/id/register`).
2. Isi: nama Anda, email, password (≥ 8 karakter), dan **Nama Perusahaan**.
3. Submit → sistem otomatis:
   - Membuat user baru
   - Membuat Organization baru dengan slug otomatis dari nama perusahaan
   - Menambahkan Anda sebagai OWNER
   - Mengisi format penomoran dokumen default (lihat §6)
4. Anda langsung ter-login dan diarahkan ke dashboard.

---

## 3. Master Data

Akses dari sidebar **Master Data**:

### 3.1 Satuan (Units)
Kode pendek satuan pakai yang muncul di label dan laporan. Contoh: `PCS`, `BOX`, `KG`, `L`, `M`.
- Kode unik per tenant.
- Bisa di-nonaktifkan (soft-delete) — tidak akan muncul lagi di dropdown form transaksi, tapi tetap dipakai di transaksi historis.

### 3.2 Kategori (Categories)
Pengelompokan barang untuk filter laporan. Contoh: Elektronik, Sembako, Alat Tulis.
- Slug otomatis dari nama; unik per tenant.

### 3.3 Barang (Items / SKU)
Daftar SKU yang dipakai di semua transaksi.

| Field | Wajib? | Catatan |
|---|---|---|
| SKU | ya | Unik per tenant. Pakai konvensi sendiri, mis. `ELK-001`. |
| Nama | ya | Nama yang muncul di laporan & label. |
| Kategori | tidak | Boleh kosong (item akan tampil "—"). |
| Satuan | ya | Pilih dari Units yang aktif. |
| Barcode/EAN | tidak | Akan di-encode ke QR. Jika kosong, QR pakai SKU. |
| Stok minimum | tidak | 0 = tidak ada alert. Item di bawah stok ini muncul di laporan Stok Rendah. |
| Deskripsi | tidak | Bebas. |

### 3.4 Supplier & Customer
Master daftar supplier (sumber barang masuk) dan customer/tujuan (tujuan barang keluar). Field standar: kode unik per tenant, nama, kontak, email, alamat, NPWP.

### 3.5 Gudang (Warehouses)
Master lokasi fisik penyimpanan. Setiap transaksi terikat ke 1 gudang. Pakai `isDefault` untuk gudang yang dipilih otomatis di form transaksi baru.

---

## 4. Transaksi

Semua transaksi tersedia di sidebar **Transaksi**. Bentuk umumnya: header (nomor, tanggal, gudang, lawan transaksi, catatan) + multi-line detail (item + qty).

### 4.1 Barang Masuk (Goods Receipt)
Untuk mencatat barang masuk dari supplier atau sumber lain.

1. Sidebar → **Barang Masuk** → tombol **Tambah**.
2. Pilih **Gudang** tujuan, **Supplier** (opsional — kosongkan untuk barang masuk internal), **Tanggal**, **Catatan**.
3. Tambahkan baris detail (Item + Qty). Bisa multi-baris.
4. **Simpan** → header tersimpan dengan status **POSTED**, nomor dokumen otomatis (mis. `GR-202605-0001`), dan stok bertambah di Stock Ledger.

**Cetak surat jalan/PDF:** dari halaman detail, klik **Cetak** untuk PDF.

**Batalkan:** klik **Batalkan**, isi alasan (wajib). Sistem akan menulis baris pembalik di ledger; saldo stok kembali. Item yang sudah dipakai di transaksi lain TIDAK bisa di-cancel kalau menyebabkan stok minus (sistem akan menolak dengan error `INSUFFICIENT_STOCK`).

### 4.2 Barang Keluar (Goods Issue)
Untuk mencatat barang keluar ke customer/internal use.

Sama seperti Goods Receipt, tapi:
- Field "Tujuan" pakai **Customer** (opsional).
- Sistem **menolak** kalau qty melebihi stok yang ada di gudang itu — bisa pakai Penyesuaian dulu kalau memang fisik ada.
- Nomor dokumen pakai template GI (default `GI-{YYYY}{MM}-{SEQ:4}`).

### 4.3 Penyesuaian Stok (Stock Adjustment)
Untuk koreksi cepat — misal hasil stock opname (stock-take) atau barang rusak/hilang.

- Per baris: pilih Item, arah `IN` (tambah) atau `OUT` (kurang), dan Qty.
- **Alasan** wajib diisi (akan muncul di laporan audit).
- Sistem tetap mencegah stok minus untuk baris `OUT`.

---

## 5. Stok & Laporan

Akses dari sidebar **Laporan**.

| Menu | Isinya |
|---|---|
| **Stok** | Daftar semua item dengan saldo per gudang; filter by kategori, search SKU/nama, indikator low-stock. |
| **Mutasi** | Buku besar movement per periode; filter by item, kategori, jenis transaksi. |
| **Stok Rendah** | Item yang saldo < minStock. |
| **Laporan** | Ringkasan & export Excel/PDF. |

**Export:** tombol Excel / PDF tersedia di setiap halaman laporan utama. File mengandung kop dengan nama org + tanggal cetak.

**Kartu Stok per Item:** dari Items → klik **Kartu Stok**. Menampilkan semua mutasi item itu (tanggal, jenis, nomor dokumen, qty, saldo running balance).

---

## 6. Pengaturan (Settings)

Sidebar → **Pengaturan**. Hanya OWNER & ADMIN yang bisa mengubah; OPERATOR/VIEWER lihat-only.

### 6.1 Profil Organisasi
Edit nama perusahaan, alamat, NPWP, URL logo, mata uang (kode 2–8 huruf seperti `IDR`, `USD`), zona waktu, dan bahasa default. **Slug tenant tidak bisa diubah** karena dipakai di dalam kode dokumen dan referensi internal.

### 6.2 Format Nomor Dokumen
Untuk setiap jenis dokumen (Barang Masuk, Barang Keluar, Penyesuaian, PO, SO, Invoice), Anda bisa:

- Edit **template** menggunakan placeholder berikut:

  | Placeholder | Arti | Contoh |
  |---|---|---|
  | `{YYYY}` | Tahun 4 digit | 2026 |
  | `{YY}` | Tahun 2 digit | 26 |
  | `{MM}` | Bulan 2 digit | 05 |
  | `{DD}` | Tanggal 2 digit | 27 |
  | `{SEQ:N}` | Counter zero-padded N digit (wajib ada) | `{SEQ:4}` → 0001 |
  | `{ORG}` | Kode singkat organisasi (slug, huruf besar) | WAREHOUSESTOK39-DEMO |

  Contoh template valid: `GR-{YYYY}{MM}-{SEQ:4}`, `INV/{YY}/{MM}/{SEQ:5}`, `ADJ-{YYYY}-{SEQ:3}`.

  Karakter lain yang diperbolehkan: huruf, angka, `_ - / . :` dan placeholder di atas. Template **wajib mengandung** `{SEQ:N}`.

- Pilih **Reset policy** counter:
  - **Tidak pernah** — counter terus naik selamanya
  - **Reset tiap tahun** — counter kembali ke 1 setiap 1 Januari
  - **Reset tiap bulan** — counter kembali ke 1 setiap awal bulan

- **Pratinjau live** di samping template menunjukkan bentuk akhir nomor (`counter = 1`).

Setelah Anda simpan, nomor dokumen yang sudah pernah dipakai **tidak ikut berubah** — hanya transaksi baru yang pakai template terbaru.

---

## 7. QR Label

Dari halaman **Master Data → Barang**, kolom Aksi punya link **Label QR** untuk tiap item. Klik akan membuka PDF dengan:

- QR code (mengkodekan barcode/EAN item, atau SKU kalau barcode kosong)
- Nama Organisasi
- Nama item
- SKU + kode satuan

Cetak PDF tersebut ke label printer (atau A4 → potong) lalu tempel ke rak/box. Saat input transaksi via barcode scanner, scanner cukup membaca kode di label tersebut.

---

## 8. FAQ Singkat

**Q: Tenant baru ngapain dulu?**
1. Login → **Pengaturan → Profil Organisasi** → isi alamat, NPWP, logo, currency, timezone.
2. **Pengaturan → Format Nomor Dokumen** → cek/ubah template sesuai konvensi internal Anda.
3. **Master Data → Satuan** → tambahkan satuan custom (di luar default PCS/BOX/KG).
4. **Master Data → Kategori** → kelompokkan barang.
5. **Master Data → Gudang** → tambahkan lokasi fisik (kalau lebih dari 1).
6. **Master Data → Barang** → input SKU. Kalau banyak, lakukan via Prisma Studio atau import (fase berikutnya).
7. **Pengaturan → User Management** (fase berikutnya) → undang anggota tim.

**Q: Stok minus terjadi — kenapa?**
Tidak akan. Sistem menolak Barang Keluar / Adjustment OUT yang melebihi saldo gudang saat itu. Pesan error: `INSUFFICIENT_STOCK`.

**Q: Salah input qty?**
Transaksi yang sudah POSTED tidak bisa di-edit. Lakukan **Batalkan** + buat transaksi baru, atau pakai **Penyesuaian** untuk koreksi cepat.

**Q: Lupa password?**
Reset via Postgres langsung (fase berikutnya akan ada UI reset password). Hubungi admin/maintainer database.

**Q: Bisa multi-bahasa di laporan?**
Saat ini laporan PDF/Excel ikut locale yang aktif di URL (`/id/...` atau `/en/...`). Pengaturan **Bahasa default** di profil organisasi dipakai untuk user baru yang belum punya preferensi.

---

## 9. Roadmap singkat

Sprint 1–7 = MVP (foundation → auth → master data → transaksi → laporan → barcode & settings → polish & launch).

Fase 2 (di luar MVP) menyusul: Purchase Order/Sales Order, Invoice, multi-gudang transfer, scan kamera HP, user & role management UI, dashboard grafik, audit log. Lihat [`docs/SPEC.md`](SPEC.md) untuk detail.
