import { v4 as uuidv4 } from "uuid";
import { requireAdmin } from "../../../lib/auth";
import {
  createResumableUploadSession,
  findOrCreateCategoryFolder,
  buildDriveFileName,
} from "../../../lib/googleDrive";
import { appendRow } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

const MAX_SIZE = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 20 * 1024 * 1024);

/**
 * Menerima tanggal dalam format YYYY-MM-DD dan mengembalikannya apa adanya
 * bila sah. Nilai kosong atau tidak sah dikembalikan sebagai string kosong,
 * sehingga kolomnya tetap bersih alih-alih berisi "Invalid Date".
 */
function normalkanTanggal(nilai) {
  const teks = String(nilai || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return "";
  const d = new Date(`${teks}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : teks;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return; // requireAdmin already sent the response

  const { fileName, mimeType, fileSize, kategori, tanggalBerlaku } = req.body;

  if (!fileName || !mimeType || !fileSize) {
    return res.status(400).json({ error: "fileName, mimeType, fileSize wajib diisi" });
  }
  // Kategori wajib: menentukan folder tujuan di Drive, jadi tidak bisa kosong.
  const kategoriBersih = String(kategori || "").trim();
  if (!kategoriBersih) {
    return res.status(400).json({ error: "Kategori wajib dipilih" });
  }
  if (mimeType !== "application/pdf") {
    return res.status(400).json({ error: "Hanya file PDF yang diperbolehkan" });
  }
  if (fileSize > MAX_SIZE) {
    return res.status(400).json({ error: "Ukuran file melebihi 20MB" });
  }

  const documentId = uuidv4();
  // Nama di Drive kini mengikuti nama dokumen di aplikasi, bukan UUID mentah.
  const driveFileName = buildDriveFileName(fileName, documentId);

  const origin = req.headers.origin || `https://${req.headers.host}`;

  let resumableSessionUrl;
  try {
    const parentFolderId = await findOrCreateCategoryFolder(kategoriBersih);
    resumableSessionUrl = await createResumableUploadSession({
      fileName: driveFileName,
      mimeType,
      fileSize,
      origin,
      parentFolderId,
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "Gagal membuat sesi upload ke Google Drive" });
  }

  try {
    await appendRow("Documents", {
      documentId,
      namaDokumen: fileName,
      kategori: kategoriBersih,
      // Opsional. Hanya diisi untuk dokumen yang memang baru disahkan; dokumen
      // lama dibiarkan kosong.
      tanggalBerlaku: normalkanTanggal(tanggalBerlaku),
      driveFileId: "",
      uploadedBy: session.email,
      uploadedAt: new Date().toISOString(),
      status: "pending",
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: `Gagal mencatat dokumen ke spreadsheet: ${err.message}` });
  }

  return res.status(200).json({ documentId, resumableSessionUrl });
}

export default withErrorHandling(handler);
