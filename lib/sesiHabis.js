/**
 * Mengalihkan ke halaman masuk dengan keterangan bahwa sesi telah berakhir.
 *
 * Dipakai setiap kali server membalas 401. Sebelumnya pengalihan dilakukan
 * tanpa keterangan apa pun, sehingga pengguna hanya merasa "tiba-tiba
 * terlempar keluar" — terutama pada jalur batas 12 jam dan pada tab yang lama
 * ditinggalkan, yang tidak melewati pewaktu diam di peramban.
 */
export function keLoginSesiHabis(router) {
  if (typeof window !== "undefined" && window.location.pathname === "/login") return;
  router.push("/login?sebab=habis");
}

/**
 * Memeriksa satu balasan fetch. Mengembalikan true bila permintaan ditolak
 * karena sesi tidak berlaku lagi dan pengalihan sudah dijalankan.
 */
export function tanganiSesiHabis(res, router) {
  if (res.status === 401) {
    keLoginSesiHabis(router);
    return true;
  }
  return false;
}
