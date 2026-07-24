import Foundation
import SwiftUI

// ============================================================================
// Der SICHTBARKEITS-ZUSTAND einer Personen-Detailseite.
//
// Er beantwortet genau eine Frage: WELCHE ABSCHNITTE DARF DIESE:R BETRACHTER:IN
// UEBERHAUPT SEHEN — und zwar ausschliesslich aus dem, was der Server geliefert
// hat (`MemberProfile`-Flags + `null`-Sektionen). Es gibt hier bewusst KEINE
// Rollenabfrage: „bin ich Vorstand" waere eine zweite Wahrheit neben der des
// Servers, und die beiden liefen frueher oder spaeter auseinander.
//
// DIE REGEL, DIE DIE GANZE DATEI TRAEGT:
//   darf nicht gesehen werden  →  Abschnitt EXISTIERT NICHT (kein leeres Feld,
//                                 kein „Nicht hinterlegt", keine Ueberschrift)
//   darf gesehen werden, ist leer  →  Feld mit „Nicht hinterlegt" (das ist eine
//                                 ehrliche Auskunft an Verwaltende: „nichts da")
// ============================================================================

@MainActor
final class MemberProfileViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var state: LoadState = .idle
    @Published private(set) var profile: MemberProfileView?
    /// Darf ich dieser Person schreiben? Aus `GET /chat/recipients`
    /// (`app.chat_dm_allowed` — Kinderschutz). `nil` = noch nicht bekannt.
    @Published private(set) var mayMessage: Bool?

    private var loadedMemberId: String?

    // MARK: - Laden

    func loadIfNeeded(memberId: String, api: APIClient, clubId: String) async {
        guard loadedMemberId != memberId || state == .idle else { return }
        await load(memberId: memberId, api: api, clubId: clubId)
    }

    func load(memberId: String, api: APIClient, clubId: String) async {
        loadedMemberId = memberId
        state = .loading
        do {
            profile = try await api.memberProfileView(clubId: clubId, memberId: memberId)
            state = .loaded
        } catch {
            profile = nil
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
        // Kuer, kein Pflicht-Call: faellt die Empfaengerliste aus, bleibt der
        // Knopf „Nachricht senden" WEG. Lieber ein fehlender Knopf als einer,
        // der in ein 403 laeuft.
        do {
            let allowed = try await api.chatRecipients(clubId: clubId)
            mayMessage = allowed.contains { $0.id == memberId }
        } catch {
            mayMessage = false
        }
    }

    // MARK: - Sichtbarkeiten (NUR aus der Server-Antwort abgeleitet)

    /// Sieht der/die Betrachter:in ueberhaupt Verwaltungsdaten dieser Person?
    ///
    /// Ist das falsch, wird die Seite zur PERSONEN-KARTE: Bild-oder-Monogramm,
    /// veroeffentlichte Beschreibung, freigegebene Galerie-Bilder, „Nachricht
    /// senden" — und sonst NICHTS. Genau das ist der Befund vom iPhone.
    ///
    /// Solange nichts geladen ist (oder der Aufruf scheiterte), gilt die
    /// STRENGERE Annahme: Personen-Karte. Ein Ladefehler darf nie dazu fuehren,
    /// dass mehr gezeigt wird als erlaubt.
    var showsAdministrativeSections: Bool {
        guard let profile else { return false }
        return profile.contactVisible || profile.adminContactVisible || profile.joinedOnVisible
    }

    /// Darf E-Mail/Geburtsdatum (Eltern-Kontakt, 0054) gezeigt werden?
    var showsContactFields: Bool { profile?.contactVisible ?? false }

    /// Darf Telefon/Anschrift (Verwaltungs-Kontakt) gezeigt werden?
    var showsAdminContactFields: Bool { profile?.adminContactVisible ?? false }

    /// Darf „im Verein seit" gezeigt werden?
    var showsJoinedOn: Bool { profile?.joinedOnVisible ?? false }

    /// Darf das veroeffentlichte Selbst-Profil gezeigt werden? (0053: oeffentlich
    /// gestellt · Vorstand/Trainerstab · die Person selbst bzw. ihre Eltern.)
    var showsSelfProfile: Bool { profile?.selfProfileVisible ?? false }

    /// Die freigegebenen Galerie-Bilder. `nil`/leer ⇒ kein Abschnitt.
    ///
    /// `photos == nil` heisst SERVERSEITIG: fuer diese Person liegt KEINE
    /// wirksame Einwilligung `photos_internal` vor (app.has_internal_photo_consent,
    /// Migration 0056) — rollenunabhaengig, auch der owner sieht dann nichts.
    var consentedPhotos: [MemberPhoto] { profile?.photos ?? [] }

    /// Hat diese Person eine wirksame Foto-Einwilligung? Ableitbar aus dem
    /// `null`-vs.-Liste-Vertrag des 360-Grad-Endpunkts (member-profile.ts:346).
    var hasPhotoConsent: Bool { profile?.photos != nil }

    /// Der Medien-Key des PERSONEN-BILDES — oder `nil` fuer die Monogramm-Kachel.
    ///
    /// ⚠️ WARUM HIER EINE ZWEITE WACHE STEHT (Leitplanke, nicht Geschmack):
    /// `avatar_url` traegt serverseitig KEINE Einwilligungs-Wache. Es wird nur
    /// aus `avatar_key` abgeleitet (lib/avatar.ts) und durchlaeuft weder
    /// `redactMemberForViewer` noch `has_internal_photo_consent`. In einem
    /// Verein voller Kinder darf ein Gesicht aber nicht allein deshalb auf dem
    /// Schirm landen, weil irgendwann jemand eine Datei hochgeladen hat.
    ///
    /// Deshalb haengt die ANZEIGE am einzigen belastbaren Einwilligungs-Signal,
    /// das der Server ueber diese Person liefert: `photos != nil`. Fuer die
    /// eigene Person gilt die Wache nicht — sein eigenes Bild darf jede:r sehen.
    /// Fehlt eines von beidem, steht dort die Monogramm-Kachel. (Der saubere
    /// Ort waere die API: siehe Bericht.)
    func personPhotoKey(isSelf: Bool) -> String? {
        guard isSelf || hasPhotoConsent else { return nil }
        guard let url = profile?.member.avatarUrl else { return nil }
        let prefix = "/media/"
        guard url.hasPrefix(prefix) else { return nil }
        let key = String(url.dropFirst(prefix.count))
        return key.isEmpty ? nil : key
    }

    // MARK: - Veroeffentlichte Beschreibung

    /// Ein Feld des veroeffentlichten Selbst-Profils („das eigene Wort").
    struct AboutItem: Identifiable {
        let id: String
        let labelKey: LocalizedStringKey
        let systemImage: String
        let value: String
    }

    /// Motto · Lieblingsdisziplin · „laeuft seit" — NUR was wirklich da ist.
    /// Leer ⇒ der ganze Abschnitt entfaellt (keine Ueberschrift ueber nichts).
    var aboutItems: [AboutItem] {
        guard showsSelfProfile, let member = profile?.member else { return [] }
        var items: [AboutItem] = []
        if let motto = member.profileMotto?.trimmed, !motto.isEmpty {
            items.append(AboutItem(
                id: "motto",
                labelKey: "members.person.about.motto",
                systemImage: "quote.opening",
                value: motto
            ))
        }
        if let discipline = member.profileFavoriteDiscipline?.trimmed, !discipline.isEmpty {
            items.append(AboutItem(
                id: "discipline",
                labelKey: "members.person.about.discipline",
                systemImage: "figure.ice.skating",
                value: discipline
            ))
        }
        if let since = member.profileSkatingSince {
            items.append(AboutItem(
                id: "since",
                labelKey: "members.person.about.since",
                systemImage: "calendar",
                value: String(since)
            ))
        }
        return items
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
