import Foundation
import SwiftUI

/// Persistierte Dev-Session (Token + Profil).
struct DevSession: Codable, Equatable {
    let accessToken: String
    let expiresAt: Date
    let persona: String
    let profile: DevLoginProfile

    var isExpired: Bool { expiresAt <= Date() }
}

/// Auth-Zustand der App: Persona-Login gegen den lokalen Dev-Stack.
///
/// WICHTIG (bewusste Dev-Entscheidung): Das Token liegt in UserDefaults,
/// NICHT im Keychain. Es ist ein 12-h-Dev-Token des lokalen Stacks ohne
/// jeden Wert außerhalb dieser Maschine. Sobald echte GoTrue-Logins kommen,
/// MUSS hier Keychain-Storage rein — dieser Kommentar ist der Marker dafür.
@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var session: DevSession?
    @Published private(set) var isLoggingIn = false
    @Published var loginError: String?

    /// Der Verein, den der Betreiber gerade BETRETEN hat — oder `nil`.
    ///
    /// Reiner Anzeige-/Kontext-Zustand (Spiegel `operator-club.ts`): er entscheidet
    /// nur, welche `club_id` die Portal-Aufrufe tragen (siehe `clubId`-Getter). Es ist
    /// KEIN Rechte-Trick — das Token bleibt Byte für Byte unverändert. Ob der Zugriff
    /// erlaubt ist, entscheidet allein der Server (`requirePlatformAdmin` +
    /// operator-access-Middleware, Migration 0051), und er PROTOKOLLIERT dabei jeden
    /// Zugriff append-only. Wer die id ohne Betreiber-Claim setzt, bekommt 403/leer.
    @Published private(set) var operatorClub: OperatorClub?

    private static let defaultsKey = "rsm.dev.session"

    /// API-Client mit Bearer-Token aus der aktuellen Session.
    /// Screen-Teams holen sich den Client IMMER hier (nie selbst bauen),
    /// damit Token-Wechsel/Logout automatisch greifen.
    private(set) lazy var api: APIClient = {
        APIClient(tokenProvider: { [weak self] in
            // tokenProvider läuft synchron im Request-Aufbau; SessionStore
            // ist MainActor — Zugriff via MainActor.assumeIsolated wäre
            // strenger, für den Dev-Stack reicht der direkte Read.
            self?.currentToken
        })
    }()

    /// Nonisolated Kopie des Tokens für den tokenProvider.
    private nonisolated(unsafe) var currentToken: String?

    init() {
        restore()
    }

    /// Angemeldet, solange eine nicht abgelaufene Session existiert.
    var isAuthenticated: Bool {
        guard let session else { return false }
        return !session.isExpired
    }

    /// Die Vereins-ID für alle club-gebundenen Calls.
    ///
    /// EIN Choke-Point (Spiegel `activeClubId()` in client.ts): Hat der Betreiber
    /// einen Verein betreten, tragen ALLE ~42 Portal-Views automatisch dessen id —
    /// ohne eine einzige View-Änderung, weil sie alle hier lesen.
    ///
    /// FAIL-CLOSED: Der Override wird NUR bei Betreiber-Claim honoriert (Spiegel
    /// `readOperatorClub`, operator-club.ts:101-110). Ohne Claim wird er ignoriert —
    /// sonst sähe eine Nicht-Admin-Persona nach einem Wechsel am selben Gerät einen
    /// fremden „aktiven Verein" und bekäme unerklärliche 403.
    var clubId: String {
        if isPlatformAdmin, let operatorClub {
            return operatorClub.id
        }
        return session?.profile.clubId ?? DevConfig.seedClubID
    }

    /// Trägt das Token den Betreiber-Claim (`app_metadata.is_platform_admin`)?
    ///
    /// NUR SICHTBARKEIT. Die Betreiber-Konsole blendet damit ihren Zugang ein
    /// und spart den sinnlosen Fetch; verbindlich entscheidet weiterhin der
    /// Server (`requirePlatformAdmin` auf jedem `/platform/*`-Endpoint) — wer
    /// das Flag lokal manipuliert, bekommt dort 403.
    var isPlatformAdmin: Bool {
        session?.profile.isPlatformAdmin ?? false
    }

    /// Ist die angemeldete Person in einem Verein Mitglied? Der Plattform-Admin
    /// ist es NICHT — für ihn sind alle vereinsgebundenen Bereiche leer, und
    /// das ist kein Defekt, sondern die Datenlage.
    var hasClubMembership: Bool {
        session?.profile.clubId != nil
    }

    // MARK: - Betreiber-Kontext („Verein betreten" / „Einsicht beenden")

    /// „Verein betreten" — ab jetzt tragen die Portal-Aufrufe dessen `club_id`.
    /// Guard auf den Betreiber-Claim (fail-closed): eine Nicht-Admin-Persona kann
    /// diesen Zustand gar nicht erst setzen.
    func enterOperatorClub(_ club: OperatorClub) {
        guard isPlatformAdmin else { return }
        operatorClub = club
    }

    /// „Einsicht beenden" — zurück auf die reine Betreiber-Ebene.
    func leaveOperatorClub() {
        operatorClub = nil
    }

    // MARK: - Aktionen

    func login(persona: DevPersona) async {
        guard !isLoggingIn else { return }
        isLoggingIn = true
        loginError = nil
        defer { isLoggingIn = false }
        do {
            let response = try await api.devLogin(persona: persona)
            let session = DevSession(
                accessToken: response.accessToken,
                expiresAt: Date().addingTimeInterval(TimeInterval(response.expiresIn)),
                persona: response.persona,
                profile: response.profile
            )
            apply(session)
            persist(session)
        } catch {
            loginError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Echter Login (E-Mail/Passwort, /auth/*)

    /// Anmelden mit E-Mail + Passwort gegen die live API.
    func signIn(email: String, password: String) async {
        await runAuth {
            let r = try await self.api.authLogin(email: email, password: password)
            // /auth/login liefert keinen Anzeigenamen — E-Mail-Praefix als Notbehelf.
            let hint = String(email.split(separator: "@").first ?? "").capitalized
            try await self.completeAuth(
                token: r.accessToken, expiresIn: r.expiresIn, sub: r.profile.sub,
                email: r.profile.email, isPlatformAdmin: r.profile.isPlatformAdmin,
                displayName: hint.isEmpty ? r.profile.email : hint
            )
        }
    }

    /// Konto anlegen (E-Mail + Passwort + Name) — danach sofort angemeldet.
    func register(email: String, password: String, displayName: String) async {
        await runAuth {
            let r = try await self.api.authRegister(email: email, password: password, displayName: displayName)
            try await self.completeAuth(
                token: r.accessToken, expiresIn: r.expiresIn, sub: r.profile.sub,
                email: r.profile.email, isPlatformAdmin: r.profile.isPlatformAdmin,
                displayName: displayName
            )
        }
    }

    /// Gemeinsamer Rahmen: Spinner + Fehlertext, wie login(persona:).
    private func runAuth(_ work: () async throws -> Void) async {
        guard !isLoggingIn else { return }
        isLoggingIn = true
        loginError = nil
        defer { isLoggingIn = false }
        do { try await work() }
        catch { loginError = (error as? APIError)?.errorDescription ?? error.localizedDescription }
    }

    /// Aus der /auth-Antwort eine Session bauen: Token setzen, Vereine holen
    /// (RLS-scoped, frisch registriert = leer), aktiven Verein = der erste.
    private func completeAuth(
        token: String, expiresIn: Int, sub: String, email: String,
        isPlatformAdmin: Bool, displayName: String
    ) async throws {
        // Token ZUERST, damit GET /clubs autorisiert ist.
        currentToken = token
        let clubs = (try? await api.listClubs()) ?? []
        let profile = DevLoginProfile(
            sub: sub, memberId: nil, displayName: displayName, email: email,
            clubId: clubs.first?.id, clubRole: nil, isPlatformAdmin: isPlatformAdmin
        )
        let session = DevSession(
            accessToken: token,
            expiresAt: Date().addingTimeInterval(TimeInterval(expiresIn)),
            persona: "account",
            profile: profile
        )
        apply(session)
        persist(session)
    }

#if DEBUG
    /// Dev-Automation für Smoke-Tests: das Launch-Argument
    /// `-devPersona <coach|owner|treasurer|admin|member|guest>` loggt die
    /// Persona beim Start automatisch ein (nur DEBUG-Builds; ohne Argument
    /// oder mit gültiger Session passiert nichts).
    func autoLoginFromLaunchArgumentsIfNeeded() async {
        guard
            !isAuthenticated,
            let raw = UserDefaults.standard.string(forKey: "devPersona"),
            let persona = DevPersona(rawValue: raw)
        else { return }
        await login(persona: persona)
    }
#endif

    func logout() {
        session = nil
        currentToken = nil
        // Betreiber-Kontext mit abräumen: sonst stünde die nächste Persona am
        // selben Gerät mit einem fremden „aktiven Verein" da (der clubId-Getter
        // ist zwar fail-closed, aber sauber ist sauber).
        operatorClub = nil
        UserDefaults.standard.removeObject(forKey: Self.defaultsKey)
    }

    // MARK: - Persistenz (UserDefaults — Dev only, s. Kopf-Kommentar)

    private func apply(_ session: DevSession) {
        self.session = session
        self.currentToken = session.accessToken
    }

    private func persist(_ session: DevSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        UserDefaults.standard.set(data, forKey: Self.defaultsKey)
    }

    private func restore() {
        guard
            let data = UserDefaults.standard.data(forKey: Self.defaultsKey),
            let stored = try? JSONDecoder().decode(DevSession.self, from: data),
            !stored.isExpired
        else { return }
        apply(stored)
    }
}
