import Foundation
import SwiftUI

// ============================================================================
// Zustand des „Mehr“-Rasters: WELCHE Kacheln diese Person sehen soll.
//
// Die Liste kommt vom Server (`GET /clubs/{clubId}/modules/effective`,
// Migration 0077) und wird hier NICHT nachgerechnet — kein Rollen-Mapping,
// keine Handliste, keine Vermutung. Der Client übersetzt nur noch Kachel-
// Kennung → Modul-Schlüssel (`MehrVisibility`).
//
// ### SICHTBARKEIT IST KEIN SICHERHEITSERSATZ ###
// Diese Klasse entscheidet über ein MENÜ. Sie schützt keine Daten: wer eine
// Kachel nicht sieht, darf über einen Deeplink genau so viel wie vorher, und
// wer eine sieht, bekommt dadurch kein Recht. Der Schutz sind RLS, Entitlement,
// Modul-Gates und Fähigkeiten — alle serverseitig. Ausführlich im Kopf von
// `MehrVisibility.swift`.
//
// ### DIE VIER ZUSTÄNDE — UND WARUM KEINER „ZEIG ALLES“ HEISST ###
//   loading      Der Hub zeigt ein Skelett. NICHT die Kacheln: sie erst alle
//                aufblitzen zu lassen und dann wegzunehmen wäre genau der
//                Zustand, den der Vorstand am iPhone gesehen hat.
//   loaded       Die Wahrheit des Servers.
//   noClub       Die Person ist in KEINEM Verein (Betreiber-Persona). Kein
//                Fehler, sondern die Datenlage — deshalb ohne Fehlerbanner.
//   unavailable  Server nicht erreichbar oder Nein. Rückfall auf die
//                persönlichen Bereiche + ehrliches Banner mit „Erneut
//                versuchen“. Bewusst KEIN Rückfall auf „alles anzeigen“ und
//                bewusst kein zwischengespeicherter Stand: ein alter Stand
//                zeigte womöglich genau die Kacheln, die der Verein gerade
//                weggenommen hat.
// ============================================================================

@MainActor
final class MehrVisibilityStore: ObservableObject {

    enum State: Equatable {
        case loading
        /// Die Modul-Schlüssel, die der Server für DIESE Person sichtbar meldet.
        case loaded(Set<String>)
        /// Ohne Vereinsmitgliedschaft — es gibt keine Vereinsmodule.
        case noClub
        /// Rückfall: Klartext der Ursache (für das Banner).
        case unavailable(String)
    }

    @Published private(set) var state: State = .loading

    var isLoading: Bool { state == .loading }

    /// Klartext der Ursache, solange der Rückfall greift.
    var fallbackMessage: String? {
        if case .unavailable(let message) = state { return message }
        return nil
    }

    // MARK: - Laden

    func load(api: APIClient, clubId: String, hasClubMembership: Bool) async {
        state = .loading
        // Ohne Mitgliedschaft gar nicht erst fragen: der Endpunkt verlangt
        // `is_club_member` und antwortete mit 403 — ein Fehlerbanner für einen
        // Zustand, der völlig in Ordnung ist, wäre gelogen.
        guard hasClubMembership else {
            state = .noClub
            return
        }
        do {
            let modules = try await api.listEffectiveModules(clubId: clubId)
            state = .loaded(Set(modules.map(\.moduleKey)))
#if DEBUG
            await checkModuleKeyDrift(api: api, clubId: clubId)
#endif
        } catch {
            state = .unavailable(
                (error as? APIError)?.errorDescription ?? error.localizedDescription
            )
        }
    }

    // MARK: - Sichtbarkeit einer Kachel

    /// Soll diese Kachel im Raster stehen?
    ///
    /// Nicht zuordenbare Kennungen und jeder Zustand ausser `loaded` fallen auf
    /// die konservative Seite: nur die persönlichen und claim-gegateten Kacheln
    /// bleiben. Lieber weniger zeigen als alles — der Zugriff hängt ohnehin
    /// nicht an der Kachel.
    func isVisible(tileId: String) -> Bool {
        switch MehrVisibility.binding(for: tileId) {
        case .personal, .claim:
            // Kein Vereinsmodul dahinter: es gibt serverseitig nichts, was
            // diese Kachel abschalten könnte.
            return true
        case .module(let key):
            if case .loaded(let visibleKeys) = state { return visibleKeys.contains(key) }
            return false
        case nil:
            // Kachel ohne Eintrag in `MehrVisibility.bindings` — fail-closed.
            // In DEBUG fällt das sofort auf (Meldung unten), in Release fehlt
            // eine Kachel, statt dass ein Kind eine sieht, die es nicht braucht.
#if DEBUG
            assertionFailure(
                "MehrVisibility: Kachel \"\(tileId)\" hat keinen Eintrag in bindings — "
                + "sie wird ausgeblendet. Eintrag in MehrVisibility.bindings ergänzen."
            )
#endif
            return false
        }
    }

#if DEBUG
    /// Prüft EINMAL pro Prozess, ob jeder Modul-Schlüssel aus
    /// `MehrVisibility.bindings` im Server-Katalog wirklich existiert.
    ///
    /// Warum das nötig ist: ein Tippfehler oder eine Umbenennung serverseitig
    /// (`medals` statt `medal`) blendet die Kachel LAUTLOS aus — der Filter tut
    /// dann genau das, was er soll, nur mit einem Schlüssel, den es nicht gibt.
    /// Diese Gegenprobe macht daraus einen Fehler beim ersten Start statt einer
    /// Support-Anfrage aus einem Verein.
    private static var didCheckDrift = false

    private func checkModuleKeyDrift(api: APIClient, clubId: String) async {
        guard !Self.didCheckDrift else { return }
        Self.didCheckDrift = true
        guard let catalog = try? await api.listClubModules(clubId: clubId) else { return }
        let known = Set(catalog.map(\.moduleKey))
        let unknown = MehrVisibility.referencedModuleKeys.subtracting(known).sorted()
        let untiled = known.subtracting(MehrVisibility.referencedModuleKeys).sorted()
        if !untiled.isEmpty {
            // Kein Fehler: der Server darf Module haben, für die es (noch)
            // keine Kachel gibt. Nur laut genug, dass es jemand mitbekommt.
            print("[MehrVisibility] Module ohne Kachel: \(untiled.joined(separator: ", "))")
        }
        if !unknown.isEmpty {
            assertionFailure(
                "MehrVisibility: unbekannte Modul-Schlüssel \(unknown.joined(separator: ", ")) — "
                + "diese Kacheln wären für JEDE Rolle unsichtbar. Tabelle gegen app.modules abgleichen."
            )
        }
    }
#endif
}
