import Foundation

// ============================================================================
// WELCHE KACHEL GEHÖRT ZU WELCHEM MODUL — die einzige Übersetzungstabelle
// zwischen dem „Mehr“-Raster der App und dem Modul-Katalog des Servers
// (app.modules, Migration 0044/0061/0068, Sichtbarkeit 0077).
//
// ############################################################################
// ### !!! SICHTBARKEIT IST KEIN SICHERHEITSERSATZ !!! ########################
// ############################################################################
// Diese Datei blendet KACHELN ein und aus. Sie schützt KEINE Daten.
//
//   * Wer eine Kachel hier NICHT bekommt, darf über einen Deeplink, einen
//     direkten API-Aufruf oder curl GENAU SO VIEL wie vorher. Es wird nichts
//     zusätzlich gesperrt.
//   * Wer eine Kachel BEKOMMT, gewinnt dadurch KEIN Recht. Der Screen dahinter
//     antwortet unverändert mit leerer Liste, 402 oder 403, wenn die Person
//     nicht darf.
//
// Die Grenzen liegen serverseitig und bleiben, wo sie sind: RLS-Mandanten-
// trennung (0002), Entitlement (0012), Modul-Gates (0044/0061/0068) und die
// Fähigkeiten (0022–0033). Wer ZUGRIFF einschränken will, ändert die Rolle
// (Verwaltung › Rollen & Rechte) oder den Modul-Schalter (Verwaltung › Module) —
// niemals diese Tabelle.
// ############################################################################
//
// ### WARUM ES DIESE TABELLE ÜBERHAUPT BRAUCHT ###
// Die Kachel-Kennungen der App und die Modul-Schlüssel des Servers sind an drei
// Stellen NICHT deckungsgleich, und jede Abweichung hat einen Grund:
//
//   `medals` ⇄ `medal`      — reine Namens-Drift (Plural in der App, Singular
//                             im Katalog). Genau die Sorte Kleinigkeit, die
//                             eine Kachel still verschwinden lässt; deshalb
//                             steht sie hier ausgeschrieben und wird in DEBUG
//                             gegen den Server nachgeprüft.
//   `budget`  → `finance`   — der Haushalt ist eine Ansicht der Finanzen, kein
//                             eigenes Modul. Wer die Finanzen nicht sieht, soll
//                             auch den Haushalt nicht sehen.
//   `sparten` → `departments` — Sparten und Abteilungen sind im Katalog EIN
//                             Modul (die Vereinsstruktur). Ein eigener Schalter
//                             dafür existiert serverseitig nicht.
//
// Und zwei Kacheln gehören GAR KEINEM Vereinsmodul: Übersicht und Profil sind
// persönlich. Ein Verein kann einem Kind nicht sein eigenes Profil abschalten —
// dafür gibt es im Katalog bewusst keinen Schlüssel.
// ============================================================================

/// Woran die Sichtbarkeit EINER Kachel hängt.
enum MehrModuleBinding: Equatable {
    /// Kachel eines Vereinsmoduls — sichtbar, wenn der Server den Schlüssel in
    /// `GET /clubs/{clubId}/modules/effective` mitliefert.
    case module(String)
    /// Persönlicher Bereich ohne Vereinsmodul (Übersicht, Profil). Wird nie
    /// gefiltert — es gibt serverseitig nichts, was ihn abschalten könnte.
    case personal
    /// Hängt an einem Token-Claim statt an einem Modul (Betreiber-Konsole).
    /// Die Kachel wird schon vom Aufrufer gegated (`isPlatformAdmin`); der
    /// Modul-Filter lässt sie deshalb unangetastet durch.
    case claim
}

enum MehrVisibility {

    /// Kachel-Kennung (`MehrTile.id`) → woran ihre Sichtbarkeit hängt.
    ///
    /// VOLLSTÄNDIG zu halten ist Pflicht: eine Kachel ohne Eintrag gilt als
    /// nicht zuordenbar und wird AUSGEBLENDET (fail-closed, siehe
    /// `binding(for:)`). In DEBUG schlägt zusätzlich `MehrVisibilityStore`
    /// Alarm, sobald ein hier genannter Modul-Schlüssel im Server-Katalog
    /// fehlt — damit die nächste Namens-Drift auffällt, statt eine Kachel
    /// stillschweigend zu verschlucken.
    static let bindings: [String: MehrModuleBinding] = [
        // --- Kacheln des statischen Katalogs (MehrCatalog.available) --------
        "lockers": .module("lockers"),
        "waitlists": .module("waitlists"),
        "budget": .module("finance"),            // Ansicht der Finanzen
        "profile": .personal,                    // persönlich, kein Vereinsmodul
        "notes": .module("notes"),
        "regevents": .module("regevents"),
        "departments": .module("departments"),
        "sparten": .module("departments"),       // ein Modul „Vereinsstruktur“
        "teams": .module("teams"),
        "anniversaries": .module("anniversaries"),
        "gallery": .module("gallery"),
        "document": .module("document"),
        "competition": .module("competition"),
        "facility": .module("facility"),
        "equipment": .module("equipment"),
        "checkin": .module("checkin"),
        "news": .module("news"),
        "chat": .module("chat"),
        "medals": .module("medal"),              // Namens-Drift, siehe Kopf
        "trainingplan": .module("trainingplan"),
        "exercises": .module("exercises"),
        "family": .module("family"),
        "hours": .module("hours"),
        "chart": .module("chart"),
        "dashboard": .personal,                  // persönlich, kein Vereinsmodul
        "events": .module("events"),
        "members": .module("members"),
        "routines": .module("routines"),
        "finance": .module("finance"),

        // --- bedingt eingehängte Kacheln (MehrHubView) ----------------------
        // Die Verwaltung hängt zusätzlich an `isClubAdmin`. Serverseitig kann
        // sie NIE ausgeblendet werden (0077 lehnt jede Zeile auf `manage` mit
        // 409 ab — sonst käme niemand mehr an die Einstellung heran); sie
        // fehlt in der effektiven Liste also nur, wenn die Rolle sie ohnehin
        // nicht bekommt.
        "verwaltung": .module("manage"),
        // Betreiber: Token-Claim, keine Vereinsrolle, kein Modul.
        "platform": .claim,
    ]

    /// Woran hängt diese Kachel? `nil` = nicht zuordenbar.
    ///
    /// Eine unbekannte Kennung ist bewusst KEIN „dann eben zeigen“: der Befund
    /// des Vorstands war, dass zu viel sichtbar ist. Im Zweifel weniger zeigen —
    /// verloren geht dabei nichts, denn der Zugriff hängt nicht an der Kachel.
    static func binding(for tileId: String) -> MehrModuleBinding? {
        bindings[tileId]
    }

    /// Alle Modul-Schlüssel, die diese Tabelle behauptet — für die DEBUG-
    /// Gegenprobe gegen den Server-Katalog.
    static var referencedModuleKeys: Set<String> {
        var keys: Set<String> = []
        for binding in bindings.values {
            if case .module(let key) = binding { keys.insert(key) }
        }
        return keys
    }
}
