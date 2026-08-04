import Foundation

/// Schreib-Endpunkt des Chat-Meldesystems (Migration 0082). Getrennt von den
/// geteilten `Endpoints.swift`, damit parallele Arbeit nicht kollidiert.
extension APIClient {

    /// POST /chat/reports — eine FREMDE Nachricht als Verstoss melden. Der
    /// Server leitet den Melder aus der eigenen Zeile ab, setzt die IP aus der
    /// Anfrage und baut den Snapshot serverseitig (unter der RLS des Melders) —
    /// die UI reicht nur `clubId`/`messageId`/`reason` weiter. Melden lässt sich
    /// nur, was man sehen darf (sonst 404). Antwort ist die angelegte `ChatReport`.
    func reportChatMessage(clubId: String, messageId: String, reason: String) async throws -> ChatReport {
        let create = ChatReportCreate(clubId: clubId, messageId: messageId, reason: reason)
        return try await post("/chat/reports", body: create)
    }
}
