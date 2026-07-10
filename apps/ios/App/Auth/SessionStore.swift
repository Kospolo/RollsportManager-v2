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
    var clubId: String {
        session?.profile.clubId ?? DevConfig.seedClubID
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
