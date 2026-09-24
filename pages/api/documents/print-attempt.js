import { requireSession } from "../../../lib/auth";
import { logAudit } from "../../../lib/sheets";
import { withErrorHandling } from "../../../lib/apiHandler";

/**
 * Mencatat percobaan mencetak dari halaman baca.
 *
 * Pencetakan sudah digagalkan di peramban, tetapi percobaannya tetap dicatat:
 * orang yang berulang kali mencoba mencetak dokumen baca-saja adalah pola
 * yang perlu diketahui QA, bukan sekadar kejadian teknis yang terabaikan.
 */
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const { documentId } = req.body || {};
  if (!documentId) return res.status(400).json({ error: "documentId wajib diisi" });

  await logAudit({
    userEmail: session.email,
    documentId,
    action: "PRINT_ATTEMPT",
    detail: "Percobaan mencetak dari halaman baca (digagalkan)",
  });

  return res.status(200).json({ success: true });
}

export default withErrorHandling(handler);
