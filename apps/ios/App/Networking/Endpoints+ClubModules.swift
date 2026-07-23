import Foundation

// ============================================================================
// Modul-Schalter des Vereins (Migration 0044, services/api/src/routes/modules.ts).
//
// Die UND-Kette, die dahintersteht:
//     gekauft (Entitlement)  UND  eingeschaltet (hier)  UND  erlaubt (Capability)
//
// ### DIESE DATEI SCHALTET, SIE SCHÜTZT NICHT ###
// Das Gate sind die restriktiven RLS-Policies aus 0044: ein abgeschaltetes
// Modul liefert JEDER Route 0 Zeilen und lässt jeden Schreibversuch auflaufen —
// auch Routen, die es heute noch gar nicht gibt. Wer diesen Schalter umgeht,
// gewinnt nichts.
//
// ### `enabled` IST NICHT `available` ###
// `enabled` = der Schalter des Vereins. `available` = was daraus WIRKLICH folgt
// (Schalter UND Lizenz). Ein PRO-Modul kann eingeschaltet und trotzdem nicht
// verfügbar sein, weil das Entitlement fehlt. Deshalb antwortet die API nach
// dem Schalten mit dem NEU GELESENEN Zustand — nie mit dem Echo des Formulars.
// ============================================================================

extension APIClient {

    /// GET /clubs/{clubId}/modules — alle Module mit Beschriftung (DE/EN),
    /// Kernmodul-Kennung, PRO-Pflicht, Schalterstellung und Verfügbarkeit.
    func listClubModules(clubId: String) async throws -> [ClubModuleState] {
        try await get("/clubs/\(clubId)/modules")
    }

    /// PUT /clubs/{clubId}/modules/{moduleKey} — Modul ein-/ausschalten.
    ///
    /// Antwort ist der WIRKLICHE Zustand nach dem Schalten. Kernmodule
    /// (Mitglieder, Finanzen, Verwaltung) antworten beim Abschalten mit 409 —
    /// bewusst nicht 403: es ist keine Rechtefrage, es geht grundsätzlich nicht.
    func setClubModule(clubId: String, moduleKey: String, enabled: Bool) async throws -> ClubModuleState {
        try await put("/clubs/\(clubId)/modules/\(moduleKey)", body: ClubModuleSet(enabled: enabled))
    }
}
