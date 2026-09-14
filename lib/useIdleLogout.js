import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

const IDLE_MS = 30 * 60 * 1000; // 30 menit tanpa aktivitas
const PERIKSA_MS = 30 * 1000; // seberapa sering kondisi diperiksa

/**
 * Mengeluarkan pengguna setelah 30 menit tanpa aktivitas.
 *
 * Server sudah menegakkan batas yang sama, tetapi tanpa penanganan di sisi
 * peramban pengguna baru menyadarinya ketika menekan sesuatu dan mendapat
 * penolakan. Di sini sesi ditutup lebih dulu dan halaman dialihkan ke layar
 * masuk dengan keterangan sebabnya.
 *
 * Waktu aktivitas terakhir disimpan di localStorage agar terbagi antar tab:
 * bekerja di satu tab menjaga tab lain tetap hidup.
 */
export default function useIdleLogout() {
  const router = useRouter();
  const keluarRef = useRef(false);

  useEffect(() => {
    const KUNCI = "sidok:aktivitas-terakhir";

    function tandaiAktif() {
      try {
        localStorage.setItem(KUNCI, String(Date.now()));
      } catch {
        /* mode privat sebagian peramban melarang penulisan — abaikan */
      }
    }

    function terakhir() {
      try {
        return Number(localStorage.getItem(KUNCI) || Date.now());
      } catch {
        return Date.now();
      }
    }

    tandaiAktif();

    // visibilitychange SENGAJA tidak termasuk di sini. Sebelumnya kembali ke
    // tab dianggap sebagai aktivitas, sehingga hitungan diam disetel ulang —
    // padahal sesi di server sudah lama hangus. Akibatnya pengguna tidak
    // pernah melihat pemberitahuan sesi berakhir, dan baru terlempar keluar
    // saat menekan sesuatu.
    const peristiwa = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    peristiwa.forEach((e) => window.addEventListener(e, tandaiAktif, { passive: true }));

    async function periksa() {
      if (keluarRef.current) return;
      if (Date.now() - terakhir() < IDLE_MS) return;

      keluarRef.current = true;
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        /* sesi tetap hangus di server meski permintaan ini gagal */
      }
      router.push("/login?sebab=idle");
    }

    // Diperiksa juga tepat saat tab kembali terlihat. Peramban memperlambat
    // bahkan menghentikan pewaktu pada tab latar belakang, jadi menunggu
    // giliran interval berikutnya tidak dapat diandalkan.
    document.addEventListener("visibilitychange", periksa);

    const jam = setInterval(periksa, PERIKSA_MS);

    return () => {
      peristiwa.forEach((e) => window.removeEventListener(e, tandaiAktif));
      document.removeEventListener("visibilitychange", periksa);
      clearInterval(jam);
    };
  }, [router]);
}
