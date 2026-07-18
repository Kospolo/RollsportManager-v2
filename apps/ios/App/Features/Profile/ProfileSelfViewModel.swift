import Foundation
import SwiftUI

// ============================================================================
// Zustand des ÖFFENTLICHEN SELBST-PROFILS im eigenen Profil (Web-Referenz:
// profil/_components/SelfProfileCard.tsx).
//
// Das Selbst-Profil ist das freiwillige, SELBST gepflegte Gegenstück zu den
// vereinsverwalteten Stammdaten: Motto („Über mich"), Lieblingsdisziplin,
// „seit wann" (Jahr) — plus die Sichtbarkeits-Stufe (öffentlich = alle aktiven
// Vereinsmitglieder / intern = Vorstand und Trainerstab).
//
// GELESEN wird die EIGENE Zeile aus der Vereinsliste (`members(clubId:)`) —
// sie trägt die `profile_*`-Werte auch bei Stufe „intern" (verifiziert).
// GESCHRIEBEN wird über `setSelfProfile` als ECHTER TEIL-PATCH: es geht nur
// mit, was tatsächlich geändert wurde.
//
// RECHTE: Nur die Person selbst (bzw. der Vormund) darf schreiben — die
// Durchsetzung steckt in app.set_self_profile + Trigger. Ein 403 kommt als
// Klartext zurück, das Formular bleibt stehen. Fremde Profile sind über diese
// Karte gar nicht erst erreichbar (sie hängt ausschließlich im eigenen Profil).
// ============================================================================

@MainActor
final class ProfileSelfViewModel: ObservableObject {

    enum State: Equatable {
        case idle
        case loading
        case loaded
        /// Kein Selbst-Profil ladbar (z. B. Konto ohne Mitgliedschaft).
        case unavailable
        case failed(String)
    }

    @Published private(set) var state: State = .idle

    // MARK: - Formular

    @Published var motto = ""
    @Published var discipline = ""
    /// Jahreszahl als Text — leer = keine Angabe.
    @Published var skatingSince = ""
    @Published var visibility: ProfileVisibility = .internal

    @Published var skatingError: LocalizedStringKey?
    @Published private(set) var isSaving = false
    /// Klartext-Fehler beim Speichern (403 „nicht berechtigt", 422 Leitplanke, …).
    @Published var saveError: String?
    /// Kurzzeitige Erfolgs-Bestätigung.
    @Published var saved = false

    // MARK: - Kontext + Diff-Basis

    private var api: APIClient?
    private var clubId: String?
    private var memberId: String?
    private var original = Snapshot()

    private struct Snapshot: Equatable {
        var motto = ""
        var discipline = ""
        var skatingSince = ""
        var visibility: ProfileVisibility = .internal
    }

    private func snapshot() -> Snapshot {
        Snapshot(
            motto: motto.trimmingCharacters(in: .whitespacesAndNewlines),
            discipline: discipline.trimmingCharacters(in: .whitespacesAndNewlines),
            skatingSince: skatingSince.trimmingCharacters(in: .whitespacesAndNewlines),
            visibility: visibility
        )
    }

    // MARK: - Abgeleitete Prüfungen (spiegeln die Server-Grenzen)

    var mottoRemaining: Int {
        APIClient.SelfProfileLimits.mottoMax - snapshot().motto.count
    }

    var mottoTooLong: Bool { mottoRemaining < 0 }

    var disciplineTooLong: Bool {
        snapshot().discipline.count > APIClient.SelfProfileLimits.disciplineMax
    }

    var isDirty: Bool { snapshot() != original }

    var canSave: Bool { isDirty && !mottoTooLong && !disciplineTooLong && !isSaving }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String, memberId: String?) async {
        self.api = api
        self.clubId = clubId
        self.memberId = memberId
        guard state == .idle else { return }
        await load()
    }

    func load() async {
        guard let api, let clubId, let memberId else {
            state = .unavailable
            return
        }
        state = .loading
        do {
            let roster = try await api.members(clubId: clubId)
            guard let me = roster.first(where: { $0.id == memberId }) else {
                state = .unavailable
                return
            }
            hydrate(from: me)
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }
    }

    /// Formular aus der Server-Zeile füllen und die Diff-Basis neu setzen.
    func hydrate(from member: ClubMember) {
        motto = member.profileMotto ?? ""
        discipline = member.profileFavoriteDiscipline ?? ""
        skatingSince = member.profileSkatingSince.map(String.init) ?? ""
        // Vorgabe „intern" (fail-safe), wenn der Server (noch) keine Stufe kennt.
        visibility = member.profileVisibility ?? .internal
        original = snapshot()
        skatingError = nil
    }

    /// Formular auf den zuletzt geladenen Serverstand zurücksetzen.
    func reset() {
        motto = original.motto
        discipline = original.discipline
        skatingSince = original.skatingSince
        visibility = original.visibility
        skatingError = nil
    }

    // MARK: - Speichern (ECHTER Teil-Patch)

    func save(api: APIClient) async {
        guard !isSaving, let clubId, let memberId else { return }
        let current = snapshot()
        guard current != original else { return }

        // Jahr vorab prüfen (der Server prüft ebenfalls) — freundliche Meldung
        // statt eines 422.
        var year: Int?
        if !current.skatingSince.isEmpty {
            guard let parsed = Int(current.skatingSince),
                  parsed >= APIClient.SelfProfileLimits.skatingSinceMin,
                  parsed <= APIClient.SelfProfileLimits.skatingSinceMax
            else {
                skatingError = "profil.self.err.year"
                return
            }
            year = parsed
        }
        skatingError = nil

        var update = ClubMemberSelfProfileUpdate()
        // Leeren Text bewusst als "" senden — der Server behandelt "" wie null
        // („Angabe löschen"); ein `nil` würde beim Encodieren wegfallen und
        // hieße „unverändert".
        if current.motto != original.motto { update.motto = current.motto }
        if current.discipline != original.discipline { update.favoriteDiscipline = current.discipline }
        var clearYear = false
        if current.skatingSince != original.skatingSince {
            if let year {
                update.skatingSince = year
            } else {
                clearYear = true
            }
        }
        if current.visibility != original.visibility { update.visibility = current.visibility }

        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await api.setSelfProfile(
                clubId: clubId,
                memberId: memberId,
                update,
                clearSkatingSince: clearYear
            )
            hydrate(from: updated)
            saved = true
        } catch {
            saveError = error.isForbiddenAPIError
                ? NSLocalizedString("profil.self.noPermission", comment: "403 beim Selbst-Profil")
                : Self.message(for: error)
        }
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
