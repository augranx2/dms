import { requireAdmin } from "../../../lib/auth";
import { updateRowByKey, findRows, logAudit } from "../../../lib/sheets";
import {
  findOrCreateCategoryFolder,
  renameAndMoveFile,
} from "../../../lib/googleDrive";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Changing a document's category also moves its file into the matching Drive
 * folder, so browsing Drive directly always mirrors what the app shows. The
 * sheet is updated first: if the Drive move then fails, the app stays correct
 * and only the Drive tree lags, which a re-save or the migration script fixes.
 */
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireAdmin(req, res);
  if (!session) return;

  const { documentId, kategori, tanggalBerlaku } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  const kategoriBersih = String(kategori || "").trim();
  if (!kategoriBersih) {
    return res.status(400).json({ error: "Kategori wajib diisi" });
  }

  const docs = await findRows("Documents", (d) => d.documentId === documentId);
  const doc = docs[0];
  if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });

  const patch = { kategori: kategoriBersih };

  // Hanya disentuh bila field-nya memang dikirim. String kosong berarti
  // menghapus tanggal, sedangkan tidak mengirim apa-apa berarti membiarkannya.
  if (tanggalBerlaku !== undefined) {
    const teks = String(tanggalBerlaku || "").trim();
    if (teks && !/^\d{4}-\d{2}-\d{2}$/.test(teks)) {
      return res.status(400).json({ error: "Format tanggal berlaku harus YYYY-MM-DD" });
    }
    patch.tanggalBerlaku = teks;
  }

  await updateRowByKey("Documents", "documentId", documentId, patch);

  let driveWarning = null;
  if (doc.driveFileId && doc.kategori !== kategoriBersih) {
    try {
      const targetFolderId = await findOrCreateCategoryFolder(kategoriBersih);
      await renameAndMoveFile(doc.driveFileId, { targetFolderId });
    } catch (err) {
      console.error("Gagal memindahkan file di Drive:", err);
      driveWarning =
        "Kategori tersimpan, tetapi file di Google Drive belum berpindah folder.";
    }
  }

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "DOCUMENT_UPDATED",
    detail:
      `kategori diubah ke "${kategoriBersih}"` +
      (patch.tanggalBerlaku !== undefined
        ? `, tanggal berlaku: ${patch.tanggalBerlaku || "(dikosongkan)"}`
        : "") +
      (driveWarning ? " (Drive gagal dipindah)" : ""),
  });

  return res.status(200).json({ success: true, warning: driveWarning });
}

export default withErrorHandling(handler);
