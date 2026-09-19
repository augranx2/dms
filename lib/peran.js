/**
 * Peran akun dan artinya.
 *
 * "Tamu" adalah akun pihak luar — auditor BPOM/BBPOM, pelanggan, atau tamu
 * lain. Kewenangannya sama persis dengan Viewer (hanya membaca dokumen yang
 * dibagikan), tetapi ia SENGAJA DIKECUALIKAN dari pembagian massal.
 *
 * Alasannya: "Bagikan ke semua" dipakai untuk dokumen yang memang berlaku bagi
 * seluruh personel internal. Bila akun pihak luar ikut terbawa, satu klik bisa
 * membuka seluruh arsip mutu kepada orang di luar perusahaan — dan kekeliruan
 * seperti itu baru ketahuan setelah dokumennya terbaca.
 */
export const PERAN = {
  Admin: { label: "Administrator", eksternal: false },
  Viewer: { label: "Pengguna", eksternal: false },
  Tamu: { label: "Tamu / Auditor", eksternal: true },
};

export const DAFTAR_PERAN = Object.keys(PERAN);

export function labelPeran(role) {
  return PERAN[role]?.label || role || "—";
}

/** Akun pihak luar: tidak pernah ikut pada pembagian massal. */
export function eksternal(role) {
  return PERAN[role]?.eksternal === true;
}

/** Hanya akun internal — dipakai sebagai sasaran "Bagikan ke semua". */
export function hanyaInternal(users) {
  return (users || []).filter((u) => !eksternal(u.role));
}
