import { v4 as uuidv4 } from "uuid";
import { getSession } from "./redis";
import { ssoAktif, periksaSso } from "./portalSso";
import { getUsersSafe } from "./sheets";

// Password hashing/verification lives entirely in Code.gs (SHA-256 + salt,
// matching the EM Viable pattern) — Node never handles raw hashes, so no
// bcrypt or similar library is needed here.

export function generateToken() {
  return uuidv4();
}

const COOKIE_NAME = "session_token";

export function setSessionCookie(res, token, maxAgeSeconds) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; Path=/; Max-Age=0`);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
}

/**
 * Reads the session cookie, looks it up in Redis, and returns the session
 * object ({ email, nama, role, ... }) or null if not logged in / expired.
 */
/**
 * Direktori pengguna DMS (tab Users), disimpan sebentar di memori.
 *
 * Saat SSO aktif, portal menentukan SIAPA yang boleh masuk, tetapi DMS tetap
 * menentukan apakah orang itu boleh memakai DMS. Tanpa pemeriksaan ini,
 * status Nonaktif di DMS tidak berarti apa-apa — akun auditor yang sudah
 * dinonaktifkan tetap bisa membaca dokumen yang pernah dibagikan kepadanya.
 *
 * Cache 60 detik mencegah setiap permintaan memanggil spreadsheet, dengan
 * konsekuensi perubahan status baru berlaku paling lambat satu menit kemudian.
 */
let direktori = { waktu: 0, data: null };
async function cariDiDirektori(username) {
  if (!direktori.data || Date.now() - direktori.waktu > 60_000) {
    direktori = { waktu: Date.now(), data: await getUsersSafe() };
  }
  const target = String(username || "").trim().toLowerCase();
  return direktori.data.find((u) => String(u.username || "").trim().toLowerCase() === target) || null;
}

export async function getCurrentSession(req) {
  // Login lewat Portal REMS (SSO_AKTIF=true): identitas & role DMS diambil
  // dari tiket login portal, bukan dari sesi DMS sendiri.
  if (ssoAktif()) {
    const h = await periksaSso(req, "dms");
    if (h.status !== "ok") return null;

    // Harus terdaftar dan Aktif di DMS. Portal bukan satu-satunya penjaga pintu.
    const lokal = await cariDiDirektori(h.user.username);
    if (!lokal || lokal.status !== "Aktif") return null;

    // Akun yang di DMS berperan Tamu tetap diperlakukan sebagai Tamu, apa pun
    // yang dikirim portal — agar pihak luar tidak pernah mendapat hak Admin
    // hanya karena salah atur di sisi portal.
    const role = lokal.role === "Tamu" ? "Tamu" : h.user.role;

    return { email: h.user.username, nama: lokal.nama || h.user.nama, role, token: "sso", sso: true };
  }
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  return { ...session, token };
}

export async function requireSession(req, res) {
  const session = await getCurrentSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}

export async function requireAdmin(req, res) {
  const session = await requireSession(req, res);
  if (!session) return null;
  if (session.role !== "Admin") {
    res.status(403).json({ error: "Forbidden - admin only" });
    return null;
  }
  return session;
}

// Only two roles exist: Admin (upload/manage/download everything) and
// Viewer (read-only BY DEFAULT). Download is no longer a property of the
// role — it is granted per document, per user, via the `canDownload` column
// on that user's Document_Access row. So the same Viewer can be download-
// allowed on one document and view-only on another.
export function isDownloadFlagTrue(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "ya" || v === "yes" || v === "1";
}
