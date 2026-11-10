# Silsilah Keluarga

Aplikasi web *mobile-first* untuk memvisualisasikan pohon keturunan keluarga.
Next.js 16 (App Router) + Tailwind CSS 4 + PostgreSQL.

## Arsitektur

```
Browser (React, client components)
   │  fetch /api/*
   ▼
Next.js BFF (Route Handlers di src/app/api)  ── validasi sesi, role & input (zod)
   │  node-postgres
   ▼
PostgreSQL (db/schema.sql)
```

- **Login**: username + password (bcrypt). Sesi disimpan di tabel `sessions`, token di cookie httpOnly.
  `src/proxy.ts` mengarahkan pengunjung tanpa cookie ke `/login`; setiap endpoint memeriksa sesi lagi.
- **Role**: `admin` dan `user`. Pendaftaran baru selalu `user`; admin bisa mengubah role di menu Admin → Pengguna.
- **Alur persetujuan**: semua penambahan/perubahan dari user masuk ke tabel `change_requests` (status `pending`).
  Data baru benar-benar masuk ke `persons`/`unions` hanya setelah admin menekan *Setujui*.
  Pengajuan dari admin langsung diterapkan (tetap tercatat di riwayat).
- **Model data**: `persons` (orang), `unions` (pasangan suami-istri). Anak menunjuk ke `parent_union_id`.

## Visualisasi

- **Mode Pohon**: suami & istri dalam satu kotak, anak-anak di bawahnya. Geser 1 jari, cubit 2 jari untuk zoom,
  ketuk kotak → zoom halus ke kotak itu + panel detail. Tombol `−`/`+N` di bawah kotak untuk melipat cabang.
  Pohon yang sangat lebar otomatis dilipat mulai generasi ke-3 saat pertama dibuka.
  Saat zoom jauh, kartu disederhanakan agar tetap ringan.
- **Mode Daftar** (ala bagan organisasi Teams): rantai leluhur di atas, keluarga yang dipilih di tengah,
  daftar anak di bawah — paling nyaman untuk silsilah besar di layar ponsel.
- Pencarian nama langsung melompat ke orangnya.

## Export Excel

Menu **Akun → Export ke Excel** (atau `GET /api/export`) mengunduh `silsilah-keluarga-YYYY-MM-DD.xlsx`
berisi seluruh anggota yang sudah disetujui. Baris judul dibekukan dan **setiap kolom punya filter**:
No, ID, Nama Lengkap, Jenis Kelamin, Tanggal Lahir, Tahun Lahir, Tempat Lahir, Tanggal Wafat, Status
(Hidup/Wafat), Generasi, Garis (Keturunan/Pasangan), Ayah, Ibu, Pasangan, Jumlah Anak, Catatan.
Kolom tanggal berisi tanggal Excel asli, jadi bisa difilter per tahun/bulan. Semua user yang login bisa export.

## Deploy dengan Docker (production)

Di server yang sudah terpasang Docker:

```bash
cp .env.production.example .env   # WAJIB: ganti POSTGRES_PASSWORD dan ADMIN_PASSWORD
docker compose up -d --build
```

Aplikasi berjalan di `http://<server>:3000` (atur dengan `APP_PORT`). Yang terjadi otomatis:

- Image dibangun multi-stage dengan `output: "standalone"` Next.js (±235 MB), berjalan sebagai user non-root.
- Saat aplikasi start, tabel dibuat/diperbarui dan akun admin pertama dibuat dari `.env`
  (lihat `src/instrumentation.ts` → `src/lib/migrate.ts`). Tidak perlu menjalankan migrasi manual.
- PostgreSQL disimpan di volume `ancestry-data` dan **tidak** membuka port ke host (app mengaksesnya lewat
  jaringan internal `ancestry-net`), jadi aman berdampingan dengan Postgres lain di server yang sama.
- Healthcheck: `GET /api/health`.

Update ke versi baru: `docker compose up -d --build` lagi. Backup database:

```bash
docker exec ancestry-db pg_dump -U ancestry ancestry > backup.sql
```

**HTTPS**: taruh di belakang reverse proxy (Caddy/nginx/Traefik) yang mengirim header `X-Forwarded-Proto`;
cookie sesi otomatis diberi flag `Secure`. Kalau aplikasi diakses lewat HTTPS tanpa proxy, set `COOKIE_SECURE=true`.

> `POSTGRES_PASSWORD` hanya berlaku saat volume database pertama kali dibuat. Untuk menggantinya kemudian,
> ubah password di Postgres (`ALTER USER`) lalu sesuaikan `.env`.

## Menjalankan secara lokal (development)

Butuh Node.js 20+ dan Docker (atau PostgreSQL sendiri).

```bash
cp .env.example .env.local      # sesuaikan bila perlu
npm install
npm run db:up                   # menyalakan PostgreSQL saja (port 5432 di localhost, lihat docker-compose.dev.yml)
npm run dev                     # tabel + akun admin dibuat otomatis saat start
npm run db:seed-demo            # (opsional) contoh silsilah 5 generasi
```

Buka http://localhost:3000 dan masuk dengan `ADMIN_USERNAME` / `ADMIN_PASSWORD` dari `.env.local`.
**Ganti password admin** sebelum dipakai sungguhan.

## Endpoint BFF

| Method | Path | Akses | Keterangan |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | publik | login |
| POST | `/api/auth/register` | publik | daftar (role `user`) |
| POST | `/api/auth/logout` | login | keluar |
| GET | `/api/auth/me` | login | user saat ini |
| GET | `/api/family` | login | semua data silsilah yang sudah disetujui |
| GET | `/api/export` | login | unduh .xlsx seluruh anggota (dengan filter kolom) |
| GET | `/api/health` | publik | cek aplikasi + koneksi database |
| GET | `/api/requests?scope=mine\|all&status=` | login | daftar pengajuan (user hanya miliknya) |
| POST | `/api/requests` | login | ajukan `add_root`, `add_child`, `add_spouse`, `add_parents`, `edit_person` |
| PATCH | `/api/requests/:id` | admin | `{ decision: "approve" \| "reject", note? }` |
| DELETE | `/api/persons/:id` | admin | hapus orang |
| GET | `/api/users` | admin | daftar pengguna |
| PATCH | `/api/users/:id` | admin | ubah role |
