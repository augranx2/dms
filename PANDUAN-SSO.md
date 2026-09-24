# Login lewat Portal REMS (SSO) — DMS

Kode ini sudah siap memakai login Portal REMS, tapi **belum aktif**. Selama
`SSO_AKTIF` belum bernilai `true`, DMS berjalan persis seperti sebelumnya.
Code.gs DMS **tidak** berubah.

## A. Sekarang: deploy dalam keadaan mati

1. Upload isi zip ke repository DMS, biarkan Vercel deploy.
2. Tambahkan Environment Variables di Vercel:

| Nama | Isi |
| --- | --- |
| `SSO_AKTIF` | `false` sekarang. Ubah ke `true` saat mengaktifkan. |
| `SSO_SECRET` | Sama persis dengan `SSO_SECRET` di project portal |
| `PORTAL_URL` | `https://portal.myrama.id` |
| `PORTAL_REDIS_URL` | Nilai `UPSTASH_REDIS_REST_URL` di project portal |
| `PORTAL_REDIS_TOKEN` | Nilai `UPSTASH_REDIS_REST_TOKEN` di project portal |

3. Redeploy. Pastikan DMS masih bisa login seperti biasa.

## B. Setelah portal pindah ke portal.myrama.id

Ubah `SSO_AKTIF` menjadi `true`, lalu Redeploy.

## Mengembalikan ke login lama

Ubah `SSO_AKTIF` menjadi `false`, lalu Redeploy.

## Yang berubah saat SSO aktif

- Halaman /login DMS langsung mengarah ke login portal, lalu kembali ke DMS
  (Admin ke dashboard admin, Viewer ke daftar dokumen).
- Role Admin/Viewer diambil dari portal. Hak dokumen per user tetap diatur
  di DMS seperti biasa, berdasarkan username yang sama.
- **DMS tetap menjadi penjaga pintu kedua.** Setiap pengguna harus terdaftar
  di tab `Users` DMS dengan status `Aktif`. Menonaktifkan akun di DMS langsung
  menutup akses DMS (paling lambat 1 menit), sekalipun orangnya masih bisa
  masuk ke portal dan aplikasi lain.
- Akun yang di DMS berperan `Tamu` selalu diperlakukan sebagai Tamu, apa pun
  peran yang dikirim portal — pihak luar tidak dapat memperoleh hak Admin
  karena salah atur di sisi portal.
- Tombol Reset password dan kolom Password awal disembunyikan di Kelola
  pengguna; password dikelola sepenuhnya oleh portal.
- Keluar (termasuk keluar otomatis setelah 30 menit diam di DMS) mengakhiri
  sesi portal, jadi berlaku untuk semua aplikasi.
- **Batas diam 30 menit.** Samakan dengan portal: isi `SESSION_IDLE_MINUTES=30`
  di Environment Variables project **portal**. Bila portal dibiarkan 60 menit,
  DMS tetap mengeluarkan pengguna setelah 30 menit diam — dan karena keluar
  bersifat global, sesi di aplikasi lain ikut berakhir.
- Ganti password lewat portal.
