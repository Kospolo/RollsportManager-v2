import Foundation
import SwiftUI

// ============================================================================
// Zustand der Modul-Verwaltung (Verwaltung › Module).
//
// Optimistisches Schalten mit Rollback: der Schalter springt sofort, denn ein
// Schalter, der erst nach dem Netz reagiert, fühlt sich kaputt an. Kommt vom
// Server ein Nein, springt er zurück UND sagt warum — die drei Nein-Fälle sind
// verschieden und dürfen nicht zu „Fehler" verschmelzen:
//
//   403  = die Rolle darf nicht (nur is_club_admin).
//   409  = Kernmodul. Keine Rechtefrage — es geht grundsätzlich nicht.
//   sonst = echter Fehler.
// ============================================================================

@MainActor
final class ModuleAdminViewModel: ObservableObject {

    enum State {
        case loading
        case forbidden
        case failed(String)
        case loaded([ClubModuleState])
    }

    @Published private(set) var state: State = .loading
    /// Module, deren Schalter gerade beim Server liegt (Zeile sperren).
    @Published private(set) var pending: Set<String> = []
    /// Klartext-Meldung des letzten Neins (Alert).
    @Published var actionError: String?

    private var hasLoaded = false

    var modules: [ClubModuleState] {
        if case .loaded(let modules) = state { return modules }
        return []
    }

    /// Zubuchbare Module (alles, was kein Kernmodul ist) — nur die haben einen
    /// Schalter. Reihenfolge wie vom Server (`sort`).
    var switchable: [ClubModuleState] { modules.filter { !$0.core } }

    /// Kernmodule: werden gezeigt, aber ohne Schalter. Sie zu verschweigen
    /// wäre eine Lücke in der Liste, die niemand erklären kann.
    var core: [ClubModuleState] { modules.filter { $0.core } }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard !hasLoaded else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        state = .loading
        do {
            let modules = try await api.listClubModules(clubId: clubId)
            hasLoaded = true
            state = .loaded(modules.sorted { $0.sort < $1.sort })
        } catch {
            if error.isForbiddenAPIError {
                state = .forbidden
            } else {
                state = .failed(Self.message(for: error))
            }
        }
    }

    // MARK: - Schalten

    func setEnabled(_ enabled: Bool, module: ClubModuleState, api: APIClient, clubId: String) async {
        guard !pending.contains(module.moduleKey) else { return }
        let before = modules
        pending.insert(module.moduleKey)
        defer { pending.remove(module.moduleKey) }

        // Optimistisch: nur `enabled` vorziehen. `available` NICHT — das hängt
        // zusätzlich an der Lizenz und darf nur vom Server kommen.
        state = .loaded(modules.map { row in
            guard row.moduleKey == module.moduleKey else { return row }
            var copy = row
            copy.enabled = enabled
            return copy
        })

        do {
            let fresh = try await api.setClubModule(
                clubId: clubId,
                moduleKey: module.moduleKey,
                enabled: enabled
            )
            state = .loaded(modules.map { $0.moduleKey == fresh.moduleKey ? fresh : $0 })
        } catch {
            state = .loaded(before)
            actionError = Self.actionMessage(for: error)
        }
    }

    // MARK: - Texte

    /// Beschriftung in der Sprache der App. Die Labels kommen aus der API
    /// (`label_de`/`label_en`) — sie stehen bewusst NICHT im String-Katalog:
    /// welche Module es gibt, entscheidet der Server, nicht der Client.
    static func label(_ module: ClubModuleState) -> String {
        isGerman ? module.labelDe : module.labelEn
    }

    static func desc(_ module: ClubModuleState) -> String {
        isGerman ? module.descDe : module.descEn
    }

    private static var isGerman: Bool {
        Locale.current.language.languageCode?.identifier == "de"
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }

    /// Die drei Nein-Fälle bleiben unterscheidbar (siehe Kopf).
    private static func actionMessage(for error: Error) -> String {
        if let apiError = error as? APIError, case .problem(let problem) = apiError {
            if problem.status == 409 {
                // Der Server erklärt das Kernmodul bereits zweisprachig und
                // nennt den Modulnamen — besser als jeder Ersatztext hier.
                return problem.detail ?? String(localized: "modules.error.core")
            }
            if problem.status == 403 {
                return String(localized: "modules.error.forbidden")
            }
        }
        return message(for: error)
    }
}
