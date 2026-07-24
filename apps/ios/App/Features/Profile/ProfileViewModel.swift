import Foundation
import SwiftUI

/// Zustand + Lade-/Schreiblogik des Features „Profil & Einstellungen“
/// (Web-Referenz: /(portal)/profil + /(portal)/einstellungen). Beide Bereiche
/// sind an den eingeloggten Nutzer gebunden (kein `club_id`): Profil über
/// `GET/PATCH /me` (`Me`/`MeUpdate`) und die App-Einstellungen über
/// `GET/PATCH /me/preferences` (`UserPreferences`/`UserPreferencesUpdate`).
///
/// Jede Rolle darf ihr EIGENES Profil bearbeiten — die Durchsetzung
/// (`member_id = self`) bleibt serverseitig (403 kommt als Klartext zurück).
@MainActor
final class ProfileViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Vier Benachrichtigungs-Kanäle (spiegeln `NotificationPrefs`).
    enum NotifKind: CaseIterable {
        case events, invoices, news, chat
    }

    // MARK: - Lade-Zustand

    @Published private(set) var state: LoadState = .idle
    @Published private(set) var profile: Me?
    @Published private(set) var preferences: UserPreferences?

    // MARK: - Bearbeiten-Formular (eigenes Profil)

    @Published var firstName = ""
    @Published var lastName = ""
    @Published var email = ""
    @Published var hasBirthDate = false
    @Published var birthDate = Calendar.current.date(byAdding: .year, value: -20, to: Date()) ?? Date()

    @Published var firstNameError: LocalizedStringKey?
    @Published var lastNameError: LocalizedStringKey?
    @Published var emailError: LocalizedStringKey?

    @Published private(set) var isSavingProfile = false
    /// Klartext-Fehler beim Profil-Speichern (403 „Keine Berechtigung“ o. Transport).
    @Published var profileSaveError: String?
    /// Kurzzeitige Erfolgsbestätigung nach dem Speichern.
    @Published var profileSaved = false

    // MARK: - Eigenes Profilbild (POST/DELETE /me/photo)

    /// Laeuft gerade ein Upload oder ein Entfernen?
    @Published private(set) var isSavingPhoto = false
    /// Klartext-Fehler des Bild-Wegs (415 „kein Bild", 413 „zu gross", Transport).
    @Published var photoError: String?

    // MARK: - Einstellungen (privat)

    /// Ausgewählte Sprache der Oberfläche — „de“ / „en“ (aus `preferences.locale`).
    @Published private(set) var localeCode = "de"
    @Published private(set) var theme: ThemePreference = .auto
    @Published private(set) var notifEvents = false
    @Published private(set) var notifInvoices = false
    @Published private(set) var notifNews = false
    @Published private(set) var notifChat = false
    /// Klartext-Fehler beim Speichern einer Einstellung (best-effort Rollback).
    @Published var settingsError: String?

    // MARK: - Original-Schnappschuss (Diff-Basis des Formulars)

    private var originalFirstName = ""
    private var originalLastName = ""
    private var originalEmailWire: String?  // nil = keine E-Mail hinterlegt
    private var originalBirthWire: String?  // nil = kein Geburtsdatum hinterlegt

    // MARK: - Abgeleitete Daten

    /// Primäre Mitgliedschaft (Kopf + Bearbeiten-Formular). `nil` = Plattform-Konto.
    var primaryMembership: MeMembership? { profile?.memberships.first }

    /// Weitere Mitgliedschaften (falls die Person in mehreren Vereinen ist).
    var otherMemberships: [MeMembership] {
        guard let all = profile?.memberships, all.count > 1 else { return [] }
        return Array(all.dropFirst())
    }

    /// Anzeigename für den Kopf: Display-Name, sonst Vor-/Nachname der Primär-
    /// Mitgliedschaft, sonst ein Gedankenstrich.
    var displayName: String {
        if let name = profile?.displayName?.trimmingCharacters(in: .whitespaces), !name.isEmpty {
            return name
        }
        if let m = primaryMembership {
            let joined = "\(m.firstName) \(m.lastName)".trimmingCharacters(in: .whitespaces)
            if !joined.isEmpty { return joined }
        }
        return "—"
    }

    /// Anmelde-E-Mail (aus der Primär-Mitgliedschaft) — nur lesend im Konto-Block.
    var accountEmail: String? { primaryMembership?.email }

    /// Medien-Key des EIGENEN Profilbildes (aus `avatar_url` = „/media/{key}“),
    /// oder `nil`, solange keines gesetzt ist. Angezeigt wird es über
    /// `MediaImage` — `GET /media/{key}` verlangt immer ein Bearer-Token.
    var photoKey: String? {
        guard let url = primaryMembership?.avatarUrl else { return nil }
        let prefix = "/media/"
        guard url.hasPrefix(prefix) else { return nil }
        let key = String(url.dropFirst(prefix.count))
        return key.isEmpty ? nil : key
    }

    var hasPhoto: Bool { photoKey != nil }

    /// Aktuelles ColorScheme aus der Theme-Präferenz (best-effort Live-Anwendung
    /// im Screen; `auto` = dem System folgen).
    var themeColorScheme: ColorScheme? {
        switch theme {
        case .light: return .light
        case .dark: return .dark
        case .auto: return nil
        }
    }

    /// `true`, wenn das Formular gegenüber dem Serverstand geändert wurde.
    var isProfileDirty: Bool { buildPatch() != nil }

    // MARK: - Laden

    /// Erstladung über `.task` — lädt nur, wenn noch nichts da ist.
    func loadIfNeeded(api: APIClient) async {
        guard state == .idle else { return }
        await load(api: api)
    }

    func load(api: APIClient) async {
        state = .loading

        // Einstellungen best-effort — schlägt der Call fehl, bleibt das Profil
        // trotzdem nutzbar (Einstellungs-Karten zeigen dann die Defaults).
        if let prefs = try? await api.getMyPreferences() {
            preferences = prefs
            hydrateSettings(from: prefs)
        }

        do {
            let me = try await api.getMyProfile()
            profile = me
            hydrateForm(from: me.memberships.first)
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }
    }

    // MARK: - Formular-Hydrierung

    private func hydrateForm(from membership: MeMembership?) {
        guard let m = membership else {
            originalFirstName = ""; originalLastName = ""
            originalEmailWire = nil; originalBirthWire = nil
            firstName = ""; lastName = ""; email = ""
            hasBirthDate = false
            clearFieldErrors()
            return
        }
        originalFirstName = m.firstName
        originalLastName = m.lastName
        originalEmailWire = m.email
        originalBirthWire = m.birthDate.map { String($0.prefix(10)) }

        firstName = m.firstName
        lastName = m.lastName
        email = m.email ?? ""
        if let wire = originalBirthWire, let date = ProfileFormat.date(fromWire: wire) {
            hasBirthDate = true
            birthDate = date
        } else {
            hasBirthDate = false
        }
        clearFieldErrors()
    }

    private func hydrateSettings(from prefs: UserPreferences) {
        localeCode = prefs.locale.lowercased().hasPrefix("de") ? "de" : "en"
        theme = prefs.theme
        notifEvents = prefs.notifications.events ?? false
        notifInvoices = prefs.notifications.invoices ?? false
        notifNews = prefs.notifications.news ?? false
        notifChat = prefs.notifications.chat ?? false
    }

    // MARK: - Profil speichern

    /// Baut den Diff gegen den Serverstand. `nil` = nichts zu speichern.
    ///
    /// HINWEIS (Contract-Lücke, gemeldet): `MeUpdate` hat nur nicht-nullbare
    /// Optionals — `nil` wird beim Encodieren WEGGELASSEN, nicht als `null`
    /// gesendet. Ein bereits gespeichertes Geburtsdatum / eine E-Mail lässt sich
    /// darüber daher nicht LEEREN (nur ändern). Setzen/Ändern funktioniert.
    private func buildPatch() -> MeUpdate? {
        let fn = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
        let ln = lastName.trimmingCharacters(in: .whitespacesAndNewlines)
        let em = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let currentBirthWire = hasBirthDate ? ProfileFormat.wireString(from: birthDate) : nil

        var patch = MeUpdate()
        var changed = false

        if fn != originalFirstName { patch.firstName = fn; changed = true }
        if ln != originalLastName { patch.lastName = ln; changed = true }
        // E-Mail nur senden, wenn nicht-leer und geändert (Leeren nicht darstellbar).
        if !em.isEmpty, em != (originalEmailWire ?? "") { patch.email = em; changed = true }
        // Geburtsdatum nur senden, wenn gesetzt und geändert.
        if let wire = currentBirthWire, wire != originalBirthWire { patch.birthDate = wire; changed = true }

        return changed ? patch : nil
    }

    /// Validiert und speichert das Profil. Erfolg reconciled Felder + Original
    /// aus der Server-Antwort und zeigt kurz eine Bestätigung; 403 landet als
    /// Klartext in `profileSaveError` (das Formular bleibt offen).
    func saveProfile(api: APIClient) async {
        guard !isSavingProfile else { return }
        clearFieldErrors()

        let fn = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
        let ln = lastName.trimmingCharacters(in: .whitespacesAndNewlines)
        let em = email.trimmingCharacters(in: .whitespacesAndNewlines)

        var invalid = false
        if fn.isEmpty { firstNameError = "profil.err.firstName"; invalid = true }
        if ln.isEmpty { lastNameError = "profil.err.lastName"; invalid = true }
        if !em.isEmpty, !ProfileValidation.isValidEmail(em) { emailError = "profil.err.email"; invalid = true }
        if invalid { return }

        guard let patch = buildPatch() else { return }

        isSavingProfile = true
        defer { isSavingProfile = false }
        do {
            let updated = try await api.updateMyProfile(patch)
            profile = updated
            hydrateForm(from: updated.memberships.first)
            profileSaved = true
        } catch {
            profileSaveError = error.isForbiddenAPIError
                ? NSLocalizedString("profil.noPermission", comment: "403 beim Profil speichern")
                : Self.message(for: error)
        }
    }

    /// Formular auf den Serverstand zurücksetzen.
    func resetForm() {
        hydrateForm(from: primaryMembership)
    }

    private func clearFieldErrors() {
        firstNameError = nil; lastNameError = nil; emailError = nil
    }

    // MARK: - Einstellungen speichern

    func chooseLocale(_ code: String, api: APIClient) async {
        guard code != localeCode else { return }
        let previous = localeCode
        localeCode = code
        do {
            let updated = try await api.updateMyPreferences(UserPreferencesUpdate(locale: code))
            preferences = updated
            hydrateSettings(from: updated)
        } catch {
            localeCode = previous
            settingsError = Self.message(for: error)
        }
    }

    func chooseTheme(_ next: ThemePreference, api: APIClient) async {
        guard next != theme else { return }
        let previous = theme
        theme = next
        do {
            let updated = try await api.updateMyPreferences(UserPreferencesUpdate(theme: next))
            preferences = updated
            hydrateSettings(from: updated)
        } catch {
            theme = previous
            settingsError = Self.message(for: error)
        }
    }

    /// Wert eines Benachrichtigungs-Kanals — für die Toggle-Bindings.
    func notifValue(_ kind: NotifKind) -> Bool {
        switch kind {
        case .events: return notifEvents
        case .invoices: return notifInvoices
        case .news: return notifNews
        case .chat: return notifChat
        }
    }

    /// Optimistisch umschalten; Server merged partiell → ein Teilobjekt pro
    /// Umschaltung genügt. Fehlschlag = Rollback + Klartext-Fehler.
    func setNotif(_ kind: NotifKind, _ value: Bool, api: APIClient) async {
        applyNotif(kind, value)
        let patch = UserPreferencesUpdate(notifications: Self.partial(kind, value))
        do {
            let updated = try await api.updateMyPreferences(patch)
            preferences = updated
            hydrateSettings(from: updated)
        } catch {
            applyNotif(kind, !value) // Rollback
            settingsError = Self.message(for: error)
        }
    }

    private func applyNotif(_ kind: NotifKind, _ value: Bool) {
        switch kind {
        case .events: notifEvents = value
        case .invoices: notifInvoices = value
        case .news: notifNews = value
        case .chat: notifChat = value
        }
    }

    private static func partial(_ kind: NotifKind, _ value: Bool) -> NotificationPrefs {
        switch kind {
        case .events: return NotificationPrefs(events: value)
        case .invoices: return NotificationPrefs(invoices: value)
        case .news: return NotificationPrefs(news: value)
        case .chat: return NotificationPrefs(chat: value)
        }
    }

    // MARK: - Helfer

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }

    // MARK: - Eigenes Profilbild

    /// Setzt das eigene Profilbild (`POST /me/photo`).
    ///
    /// `data` kommt roh aus dem `PhotosPicker` — ein iPhone-Foto ist HEIC und
    /// mehrere Megabyte gross. `ProfilePhotoEncoder` macht daraus ein gedrehtes
    /// JPEG mit 1024 px laengster Kante: das ist fuer eine 72-pt-Kachel reichlich
    /// und spart dem Verein (und dem Datentarif der Eltern) den Rest.
    ///
    /// Danach wird `/me` NEU GELESEN statt lokal gepatcht — der Server ist die
    /// Quelle des `avatar_url`, und nur so ist bewiesen, dass es wirklich liegt.
    func setPhoto(data: Data, api: APIClient) async {
        guard !isSavingPhoto else { return }
        isSavingPhoto = true
        photoError = nil
        defer { isSavingPhoto = false }

        guard let jpeg = ProfilePhotoEncoder.jpeg(from: data) else {
            photoError = String(localized: "profil.photo.err.notAnImage")
            return
        }
        do {
            try await api.uploadMyPhoto(data: jpeg)
            await reloadMe(api: api)
        } catch {
            photoError = Self.message(for: error)
        }
    }

    /// Entfernt das eigene Profilbild (`DELETE /me/photo`, idempotent).
    func removePhoto(api: APIClient) async {
        guard !isSavingPhoto else { return }
        isSavingPhoto = true
        photoError = nil
        defer { isSavingPhoto = false }

        do {
            try await api.deleteMyPhoto()
            await reloadMe(api: api)
        } catch {
            photoError = Self.message(for: error)
        }
    }

    /// `/me` nachladen, ohne den Bildschirm in den Ladezustand zu werfen (das
    /// Formular des Nutzers bleibt stehen — nur `profile` wird frisch).
    private func reloadMe(api: APIClient) async {
        guard let me = try? await api.getMyProfile() else { return }
        profile = me
    }
}
