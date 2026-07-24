import Foundation

// ============================================================================
// GET /clubs/{clubId}/modules/effective — DIE EINE QUELLE für das „Mehr“-Raster
// (Migration 0077, services/api/src/routes/modules.ts).
//
// Der Server rechnet die vier Fragen EINMAL zu Ende:
//     gekauft (Entitlement) UND eingeschaltet (club_modules)
//     UND erlaubt (Fähigkeiten) UND angeboten (Sichtbarkeit)
// und liefert NUR die Module, die diese Person im Menü sehen soll.
//
// ### WARUM DIE APP DAS NICHT SELBST RECHNET ###
// Weil sie es schon einmal getan hat: bis zu diesem Endpunkt filterte der
// „Mehr“-Hub genau ZWEI von 31 Kacheln (Betreiber + Verwaltung) — ein Kind sah
// dieselben ~29 Module wie der Vorstand. Vier Clients (Web, iOS, macOS,
// Android), die dieselbe Regel je einmal nachbauen, laufen zwangsläufig
// auseinander. Hier wird nichts nachgebaut und nichts geraten.
//
// ### DIESE ANTWORT IST EIN MENÜ, KEINE ERLAUBNIS ###
// Wer eine Kachel NICHT bekommt, darf über einen Deeplink, einen direkten
// API-Aufruf oder curl GENAU SO VIEL wie vorher — es wird nichts zusätzlich
// gesperrt. Wer eine Kachel BEKOMMT, gewinnt dadurch kein Recht: die Seite
// dahinter antwortet unverändert mit leerer Liste, 402 oder 403, wenn die
// Person nicht darf. Der Schutz der Daten sind und bleiben RLS (0002),
// Entitlement (0012), Modul-Gates (0044/0061/0068) und die Fähigkeiten
// (0022–0033) — allesamt serverseitig.
//
// Wer ZUGRIFF einschränken will, ändert die Rolle (Verwaltung › Rollen &
// Rechte) oder den Modul-Schalter (Verwaltung › Module), nicht dieses Menü.
// ============================================================================

extension APIClient {

    /// Die Module, die DIESE Person im „Mehr“-Hub sehen soll.
    ///
    /// Die Antwort ist bereits gefiltert (`where visible`) — bewusst nicht als
    /// vollständige Liste mit Flag: ein Client, der das Flag vergisst, zeigte
    /// sonst wieder alles. Genau das war der Befund.
    ///
    /// Nur für Vereinsmitglieder (`requireClubMember`): wer in keinem Verein
    /// ist (Betreiber-Persona), bekommt hier 403 — das ist kein Defekt,
    /// sondern die Datenlage.
    func listEffectiveModules(clubId: String) async throws -> [EffectiveModule] {
        try await get("/clubs/\(clubId)/modules/effective")
    }
}
