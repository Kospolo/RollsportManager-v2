import Foundation

/// Zustand des Kür-Teilen-Dialogs. Erzeugt/​widerruft öffentliche Token-Links
/// über die echten Endpunkte (POST/DELETE /routines/{id}/share…). Da der Server
/// KEINEN Listen-Endpoint für Shares hat (nur create/revoke), hält dieses
/// Modell — exakt wie die Web-Facade `listRoutineShares` — die in DIESER Session
/// erzeugten Links im Speicher. Web-Referenz: kueren/[id]/ShareRoutineDialog.
@MainActor
final class ShareRoutineViewModel: ObservableObject {

    /// Gültigkeitsauswahl für neue Links.
    enum Expiry: String, CaseIterable, Identifiable {
        case never, oneDay, sevenDays, thirtyDays
        var id: String { rawValue }

        var days: Int? {
            switch self {
            case .never: return nil
            case .oneDay: return 1
            case .sevenDays: return 7
            case .thirtyDays: return 30
            }
        }
    }

    /// In dieser Session erzeugte Links (neueste zuletzt).
    @Published private(set) var shares: [RoutineShareCreated] = []
    @Published var expiry: Expiry = .never
    @Published private(set) var isCreating = false
    @Published var errorMessage: String?
    /// `true`, wenn der letzte Fehler ein 403 war (fehlende Trainer-Rolle).
    @Published private(set) var forbidden = false

    /// Öffentlichen Link erzeugen (Trainerstab). 403 → freundlicher Hinweis.
    func create(api: APIClient, routineId: String) async {
        guard !isCreating else { return }
        isCreating = true
        defer { isCreating = false }
        forbidden = false
        do {
            let share = try await api.createRoutineShare(
                routineId: routineId,
                expiresAt: expiresAtISO()
            )
            // Doppelte Tokens ersetzen, neuen ans Ende.
            shares.removeAll { $0.token == share.token }
            shares.append(share)
        } catch {
            forbidden = error.isForbiddenAPIError
            errorMessage = forbidden
                ? NSLocalizedString("share.error.forbidden", comment: "403 beim Teilen")
                : RoutinesViewModel.message(for: error)
        }
    }

    /// Link widerrufen und aus der Liste entfernen (optimistisch nach Erfolg).
    func revoke(api: APIClient, routineId: String, token: String) async {
        do {
            _ = try await api.revokeRoutineShare(routineId: routineId, token: token)
            shares.removeAll { $0.token == token }
        } catch {
            forbidden = error.isForbiddenAPIError
            errorMessage = forbidden
                ? NSLocalizedString("share.error.forbidden", comment: "403 beim Widerrufen")
                : RoutinesViewModel.message(for: error)
        }
    }

    /// Volle, teilbare URL: relativer Server-Pfad (`/wettkampf/kuer/{token}`)
    /// hinter dem Web-Origin. Absolute URLs bleiben unverändert.
    func fullURL(for share: RoutineShareCreated) -> String {
        if share.url.hasPrefix("http://") || share.url.hasPrefix("https://") {
            return share.url
        }
        return DevConfig.webBaseURL.absoluteString + share.url
    }

    private func expiresAtISO() -> String? {
        guard let days = expiry.days else { return nil }
        let date = Calendar.current.date(byAdding: .day, value: days, to: Date()) ?? Date()
        return ISO8601DateFormatter().string(from: date)
    }
}
