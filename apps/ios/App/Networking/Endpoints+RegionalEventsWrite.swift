import Foundation

/// Schreib-Endpunkte für überregionale Termine (RegionalEvent). Anlegen liegt
/// bereits in Endpoints.swift; hier kommen Bearbeiten und Löschen dazu — beides
/// serverseitig auf die Vereinsleitung (is_club_admin) beschränkt, ein 403
/// kommt als Klartext-`APIError` zurück. Web-Referenz: events/_components/
/// RegionalEventFormSheet.tsx und DeleteRegionalEventDialog.tsx.
extension APIClient {

    /// PATCH /regional-events/{eventId} — Termin ändern. Geleerte optionale
    /// Felder werden serverseitig auf `null` gesetzt (`RegionalEventUpdate`).
    func updateRegionalEvent(eventId: String, _ input: RegionalEventUpdate) async throws -> RegionalEvent {
        try await patch("/regional-events/\(eventId)", body: RegionalEventPatchWire(input))
    }

    /// DELETE /regional-events/{eventId} — Termin löschen (Soft-Delete beim Server).
    @discardableResult
    func deleteRegionalEvent(eventId: String) async throws -> Deleted {
        try await delete("/regional-events/\(eventId)")
    }
}

/// PATCH-Body für Termin-Bearbeiten mit korrekter Leer-Semantik: leerbare Felder
/// (Enddatum, Ausrichter, Disziplin, Ort, Link, Beschreibung) explizit als null
/// senden — nur so wird aus mehrtägig wieder eintägig bzw. ein Feld geleert.
/// Titel/Startdatum bleiben omit-wenn-nil.
private struct RegionalEventPatchWire: Encodable {
    let title: String?
    let startsOn: String?
    let endsOn: String?
    let hostOrg: String?
    let discipline: String?
    let location: String?
    let registrationUrl: String?
    let description: String?

    init(_ u: RegionalEventUpdate) {
        title = u.title; startsOn = u.startsOn; endsOn = u.endsOn
        hostOrg = u.hostOrg; discipline = u.discipline; location = u.location
        registrationUrl = u.registrationUrl; description = u.description
    }

    enum CodingKeys: String, CodingKey {
        case title
        case startsOn = "starts_on"
        case endsOn = "ends_on"
        case hostOrg = "host_org"
        case discipline, location
        case registrationUrl = "registration_url"
        case description
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(startsOn, forKey: .startsOn)
        // Leerbar: nil -> JSON null.
        try c.encode(endsOn, forKey: .endsOn)
        try c.encode(hostOrg, forKey: .hostOrg)
        try c.encode(discipline, forKey: .discipline)
        try c.encode(location, forKey: .location)
        try c.encode(registrationUrl, forKey: .registrationUrl)
        try c.encode(description, forKey: .description)
    }
}
