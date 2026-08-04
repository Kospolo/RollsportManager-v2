import Foundation

// ============================================================================
// Schreib-Endpunkte des Medaillen-Features (Bearbeiten/Löschen eines Erfolgs).
// Vergeben (POST) liegt bewusst bei `medaillenCreate` in AchievementsModels.swift
// (dort auch der Contract-Workaround-Kommentar). Diese Datei ergänzt PATCH/DELETE
// und dekodiert die Antwort — wie beim Anlegen — tolerant als `MedalAchievement`
// (der generierte `Achievement.medal` ist fälschlich nicht optional; die API
// liefert bei „Teilnahme ohne Medaille" aber `medal: null`).
// ============================================================================

extension APIClient {

    /// PATCH /achievements/{achievementId} — Erfolg bearbeiten (Trainerstab;
    /// sonst `Problem` 403). Request-Body ist der generierte `AchievementUpdate`
    /// (unverändert genutzt); nur die Antwort wird tolerant als
    /// `MedalAchievement` decodiert (siehe Kopf).
    func medaillenUpdate(
        achievementId: String,
        _ update: AchievementUpdate
    ) async throws -> MedalAchievement {
        // Leerbare Felder (Medaille/Platzierung/Wettkampf/Notiz) explizit als
        // null senden, sonst behält der Server den alten Wert — eine falsch
        // vergebene Gold-Medaille eines Kindes ließe sich nie auf „ohne" ändern.
        try await patch("/achievements/\(achievementId)", body: AchievementPatchWire(update))
    }

    /// DELETE /achievements/{achievementId} — Erfolg löschen (Soft-Delete beim
    /// Server). Trainerstab; sonst `Problem` 403. Antwort ist `Deleted`.
    @discardableResult
    func medaillenDelete(achievementId: String) async throws -> Deleted {
        try await delete("/achievements/\(achievementId)")
    }
}

/// PATCH-Body für Erfolg-Bearbeiten mit korrekter Leer-Semantik: die im
/// Formular leerbaren Felder werden explizit als null gesendet (= zurücksetzen),
/// Titel/Datum bleiben omit-wenn-nil (nie versehentlich löschen).
private struct AchievementPatchWire: Encodable {
    let title: String?
    let competitionName: String?
    let placement: Int?
    let medal: Medal?
    let achievedOn: String?
    let note: String?

    init(_ u: AchievementUpdate) {
        title = u.title; competitionName = u.competitionName; placement = u.placement
        medal = u.medal; achievedOn = u.achievedOn; note = u.note
    }

    enum CodingKeys: String, CodingKey {
        case title
        case competitionName = "competition_name"
        case placement, medal
        case achievedOn = "achieved_on"
        case note
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(achievedOn, forKey: .achievedOn)
        // Leerbar: nil -> JSON null -> serverseitig zurückgesetzt.
        try c.encode(competitionName, forKey: .competitionName)
        try c.encode(placement, forKey: .placement)
        try c.encode(medal, forKey: .medal)
        try c.encode(note, forKey: .note)
    }
}
