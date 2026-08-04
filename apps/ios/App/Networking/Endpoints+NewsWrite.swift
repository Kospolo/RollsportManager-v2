import Foundation

// ============================================================================
// News SCHREIBEN (Bearbeiten + Löschen) — die iOS-Fassung der Web-Dialoge
// news/_components/NewsFormSheet.tsx (PATCH) und DeleteNewsDialog.tsx (DELETE).
// Anlegen (POST /news) steht weiterhin in Endpoints.swift. Schreiben ist
// serverseitig auf den Trainerstab beschränkt — eine fremde Rolle bekommt 403
// (RFC-7807), das über denselben `APIError`-Pfad wie überall hochblubbert.
// ============================================================================

extension APIClient {

    /// PATCH /news/{newsId} — bestehende Neuigkeit ändern (Titel · Text · Pin).
    /// Der Server liefert den aktualisierten Datensatz zurück.
    func updateNews(newsId: String, _ update: NewsUpdate) async throws -> News {
        try await patch("/news/\(newsId)", body: update)
    }

    /// DELETE /news/{newsId} — Neuigkeit löschen. Antwort ist `Deleted`
    /// (analog zu den übrigen Lösch-Routen).
    @discardableResult
    func deleteNews(newsId: String) async throws -> Deleted {
        try await delete("/news/\(newsId)")
    }
}
