import Foundation
import SwiftUI

// ============================================================================
// Zustand + Lade-/Schreiblogik der Vereins-Einstellungen (Web-Referenz:
// apps/web/app/(portal)/verwaltung/verein). Lädt den Verein (GET /clubs/{id}),
// hydriert das Formular aus den Kern-Stammdaten UND dem `settings`-JSONB
// (Kontakt / Bank / Benachrichtigungen) und schreibt über `updateClubSettings`
// (PATCH /clubs/{id}).
//
// WICHTIG (serverseitig verifiziert, services/api/src/routes/clubs.ts): PATCH
// ersetzt die `settings`-Spalte KOMPLETT (kein Merge). Deshalb starten wir beim
// Schreiben immer von der geladenen `club.settings`-Basis und überschreiben nur
// die drei von uns verwalteten Teilobjekte — fremde Settings-Keys (z. B. Tier/
// Entitlement) bleiben so erhalten.
//
// Gating: owner/admin dürfen editieren (`permissions.canManageClubSettings`,
// Web `canEdit`); alle anderen sehen die Nur-Ansicht. Der Server bleibt die
// Autorität (403 kommt als Klartext zurück, Formular bleibt stehen).
// ============================================================================

@MainActor
final class AdminClubSettingsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    // MARK: - Lade-Zustand

    @Published private(set) var state: State = .loading
    /// Der geladene Verein (Quelle der Nur-Ansicht + Diff-/Settings-Basis).
    @Published private(set) var club: Club?

    // MARK: - Formular (Kern-Stammdaten)

    @Published var name = ""
    @Published var shortName = ""
    @Published var city = ""
    @Published var discipline = ""

    // MARK: - Formular (Kontakt)

    @Published var email = ""
    @Published var phone = ""
    @Published var address = ""

    // MARK: - Formular (Bankverbindung)

    @Published var iban = ""
    @Published var accountHolder = ""
    @Published var bankName = ""

    // MARK: - Formular (Benachrichtigungs-Flags)

    @Published var notifyInvoices = true
    @Published var notifyEvents = true
    @Published var notifyNews = false

    // MARK: - Feld-Fehler + Schreib-Zustand

    @Published var nameError: LocalizedStringKey?
    @Published var emailError: LocalizedStringKey?
    @Published var ibanError: LocalizedStringKey?

    @Published private(set) var isSaving = false
    /// Klartext-Fehler beim Speichern (403 „Keine Berechtigung" o. Transport).
    @Published var saveError: String?
    /// Erfolgs-Alert nach dem Speichern.
    @Published var showSavedAlert = false

    // MARK: - Kontext + Diff-Basis

    private var api: APIClient?
    private var clubId: String?
    private var hasLoaded = false
    /// Normalisierter Serverstand — Basis für „geändert?" und den Diff-Patch.
    private var original: Snapshot?

    /// `true`, sobald das Formular vom Serverstand abweicht.
    var isDirty: Bool {
        guard let original else { return false }
        return snapshot() != original
    }

    // MARK: - Laden

    /// Erstladung über `.task` — lädt nur beim ersten Aufruf.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        self.api = api
        self.clubId = clubId
        guard !hasLoaded else { return }
        hasLoaded = true
        await load()
    }

    func retry() async { await load() }

    private func load() async {
        guard let api, let clubId else { return }
        state = .loading
        do {
            // Kein typisierter GET-Endpoint vorhanden (nur `updateClubSettings`
            // in Endpoints.swift) — deshalb bewusst die generische Verb-Methode.
            // Gemeldet als Lücke: typisiertes `club(clubId:)` fehlt.
            let club: Club = try await api.get("/clubs/\(clubId)")
            hydrate(from: club)
            state = .loaded
        } catch {
            state = .error(Self.message(for: error))
        }
    }

    // MARK: - Hydrierung

    private func hydrate(from club: Club) {
        self.club = club
        name = club.name
        shortName = club.shortName ?? ""
        city = club.city ?? ""
        discipline = club.discipline ?? ""

        let contact = ClubSettingsJSON.object(club.settings, "contact")
        email = ClubSettingsJSON.string(contact, "email")
        phone = ClubSettingsJSON.string(contact, "phone")
        address = ClubSettingsJSON.string(contact, "address")

        let bank = ClubSettingsJSON.object(club.settings, "bank")
        iban = ClubSettingsJSON.string(bank, "iban")
        accountHolder = ClubSettingsJSON.string(bank, "accountHolder")
        bankName = ClubSettingsJSON.string(bank, "bankName")

        let notify = ClubSettingsJSON.object(club.settings, "notifications")
        notifyInvoices = ClubSettingsJSON.bool(notify, "invoices", default: true)
        notifyEvents = ClubSettingsJSON.bool(notify, "events", default: true)
        notifyNews = ClubSettingsJSON.bool(notify, "news", default: false)

        original = snapshot()
        clearErrors()
    }

    /// Formular auf den zuletzt geladenen Serverstand zurücksetzen.
    func reset() {
        guard let club else { return }
        hydrate(from: club)
    }

    // MARK: - Speichern

    func save(api: APIClient) async {
        guard !isSaving else { return }
        clearErrors()
        guard validate() else { return }
        guard let clubId, let patch = buildPatch() else { return }

        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await api.updateClubSettings(clubId: clubId, patch)
            hydrate(from: updated)
            showSavedAlert = true
        } catch {
            saveError = error.isForbiddenAPIError
                ? NSLocalizedString("verein.error.forbidden", comment: "403 beim Speichern der Vereinsdaten")
                : Self.message(for: error)
        }
    }

    /// Validierung 1:1 zur Web-Referenz (Name Pflicht, E-Mail/IBAN plausibel,
    /// leere Bank-/Kontaktfelder erlaubt). `false` = mindestens ein Fehler.
    private func validate() -> Bool {
        var ok = true
        if snapshot().name.isEmpty {
            nameError = "verein.err.name"
            ok = false
        }
        let mail = email.trimmedField
        if !mail.isEmpty, !ClubFieldValidation.isValidEmail(mail) {
            emailError = "verein.err.email"
            ok = false
        }
        let normalizedIban = ClubFieldValidation.normalizeIban(iban)
        if !normalizedIban.isEmpty, !ClubFieldValidation.isValidIban(normalizedIban) {
            ibanError = "verein.err.iban"
            ok = false
        }
        return ok
    }

    /// Diff gegen den Serverstand. `nil` = nichts zu speichern. Kern-Felder gehen
    /// nur bei Änderung mit; `settings` (Voll-Replace!) nur, wenn ein Kontakt-/
    /// Bank-/Benachrichtigungs-Feld abweicht — dann inklusive fremder Keys.
    private func buildPatch() -> ClubUpdate? {
        guard let original else { return nil }
        let cur = snapshot()
        guard cur != original else { return nil }

        var patch = ClubUpdate()
        if cur.name != original.name { patch.name = cur.name }
        if cur.shortName != original.shortName { patch.shortName = cur.shortName }
        if cur.city != original.city { patch.city = cur.city }
        if cur.discipline != original.discipline { patch.discipline = cur.discipline }

        let settingsChanged =
            cur.email != original.email ||
            cur.phone != original.phone ||
            cur.address != original.address ||
            cur.iban != original.iban ||
            cur.accountHolder != original.accountHolder ||
            cur.bankName != original.bankName ||
            cur.notifyInvoices != original.notifyInvoices ||
            cur.notifyEvents != original.notifyEvents ||
            cur.notifyNews != original.notifyNews
        if settingsChanged {
            patch.settings = buildSettings(cur, base: club?.settings ?? [:])
        }
        return patch
    }

    /// Baut das volle `settings`-Objekt: fremde Keys aus `base` bleiben, nur die
    /// drei verwalteten Teilobjekte werden ersetzt (leere Strings → `null`).
    private func buildSettings(_ cur: Snapshot, base: [String: JSONValue]) -> [String: JSONValue] {
        var s = base
        s["contact"] = .object([
            "email": ClubSettingsJSON.stringOrNull(cur.email),
            "phone": ClubSettingsJSON.stringOrNull(cur.phone),
            "address": ClubSettingsJSON.stringOrNull(cur.address),
        ])
        s["bank"] = .object([
            "iban": ClubSettingsJSON.stringOrNull(cur.iban),
            "accountHolder": ClubSettingsJSON.stringOrNull(cur.accountHolder),
            "bankName": ClubSettingsJSON.stringOrNull(cur.bankName),
        ])
        s["notifications"] = .object([
            "invoices": .bool(cur.notifyInvoices),
            "events": .bool(cur.notifyEvents),
            "news": .bool(cur.notifyNews),
        ])
        return s
    }

    // MARK: - Snapshot (normalisiert)

    /// Normalisierter Momentwert des Formulars — Vergleichs-/Diff-Basis.
    struct Snapshot: Equatable {
        var name: String
        var shortName: String
        var city: String
        var discipline: String
        var email: String
        var phone: String
        var address: String
        var iban: String
        var accountHolder: String
        var bankName: String
        var notifyInvoices: Bool
        var notifyEvents: Bool
        var notifyNews: Bool
    }

    private func snapshot() -> Snapshot {
        Snapshot(
            name: name.trimmedField,
            shortName: shortName.trimmedField,
            city: city.trimmedField,
            discipline: discipline.trimmedField,
            email: email.trimmedField,
            phone: phone.trimmedField,
            address: address.trimmedField,
            iban: ClubFieldValidation.normalizeIban(iban),
            accountHolder: accountHolder.trimmedField,
            bankName: bankName.trimmedField,
            notifyInvoices: notifyInvoices,
            notifyEvents: notifyEvents,
            notifyNews: notifyNews
        )
    }

    // MARK: - Helfer

    private func clearErrors() {
        nameError = nil
        emailError = nil
        ibanError = nil
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}

/// Feld-Trimmen, feature-lokal (kein Namensclash mit parallelen Teams).
private extension String {
    var trimmedField: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
