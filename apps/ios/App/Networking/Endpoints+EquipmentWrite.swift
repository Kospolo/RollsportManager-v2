import Foundation

/// Schreib-Endpunkte der Ausrüstung (Bearbeiten + Löschen eines Gegenstands).
/// Getrennt von der geteilten `Endpoints.swift` (read-only), damit parallele
/// Feature-Teams sich nicht in die Quere kommen. Anlegen/Reservieren liegen
/// bereits in `Endpoints.swift`. Web-Referenz: /(portal)/ausruestung.
extension APIClient {

    /// PATCH /equipment/{id} — Gegenstand ändern (Name/Kategorie/Zustand/
    /// Bestand/Notiz). Berechtigung sitzt serverseitig (RLS + Rolle).
    func updateEquipment(equipmentId: String, _ input: EquipmentUpdate) async throws -> Equipment {
        try await patch("/equipment/\(equipmentId)", body: input)
    }

    /// DELETE /equipment/{id} — Gegenstand aus dem Bestand entfernen. Antwort
    /// `Deleted` fürs Aktualisieren der Liste.
    @discardableResult
    func deleteEquipment(equipmentId: String) async throws -> Deleted {
        try await delete("/equipment/\(equipmentId)")
    }
}
