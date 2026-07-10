import Foundation
import SwiftUI

/// Filter-Chips über der Offene-Posten-Liste (Design-System §3.3):
/// Alle · Offen · Erinnert · Gemahnt — gefiltert wird nach Mahnstufe
/// innerhalb der offenen Rechnungen.
enum FinanceFilter: CaseIterable, Identifiable {
    case all
    case open
    case reminded
    case dunned

    var id: Self { self }

    var labelKey: LocalizedStringKey {
        switch self {
        case .all: "finance.filter.all"
        case .open: "finance.filter.open"
        case .reminded: "finance.filter.reminded"
        case .dunned: "finance.filter.dunned"
        }
    }

    func matches(_ invoice: Invoice) -> Bool {
        switch self {
        case .all: true
        case .open: invoice.dunningLevel <= 0
        case .reminded: invoice.dunningLevel == 1
        case .dunned: invoice.dunningLevel >= 2
        }
    }
}

/// Lädt Rechnungen + Mitgliedsnamen über den APIClient aus dem SessionStore
/// und hält den Zustand des Vorschau-Mahnlaufs (immer `dry_run: true` —
/// scharfe Läufe gibt es in diesem Screen bewusst nicht).
@MainActor
final class FinanceViewModel: ObservableObject {

    enum LoadState: Equatable {
        case loading
        case error(String)
        case loaded
    }

    /// Zustand des Vorschau-Mahnlaufs; das Ergebnis liegt separat in
    /// `dunningResult`, damit das Sheet nach einem Fehler nicht verschwindet.
    enum DunningState: Equatable {
        case idle
        case running
        case forbidden
        case error(String)
    }

    @Published private(set) var state: LoadState = .loading
    @Published private(set) var invoices: [Invoice] = []
    /// member_id → Anzeigename; leer, wenn /members für die Rolle tabu ist.
    @Published private(set) var memberNames: [String: String] = [:]
    @Published var filter: FinanceFilter = .all
    @Published var selectedInvoice: Invoice?
    @Published private(set) var dunningState: DunningState = .idle
    @Published var dunningResult: DunningRunResult?

    private var hasLoaded = false

    // MARK: - Abgeleitete Werte

    /// Basis der Liste und des KPIs: nur Rechnungen mit Status `open`.
    var openInvoices: [Invoice] {
        invoices.filter { $0.status == .open }
    }

    var filteredInvoices: [Invoice] {
        openInvoices.filter { filter.matches($0) }
    }

    /// KPI „Offen gesamt“ = Summe der geladenen offenen Rechnungen.
    var openTotalCents: Int { total(of: openInvoices) }

    var filteredTotalCents: Int { total(of: filteredInvoices) }

    /// Währung von der Leitung (Seed: EUR) — für die Betragsformatierung.
    var currencyCode: String {
        openInvoices.first?.currency ?? invoices.first?.currency ?? "EUR"
    }

    func memberName(for memberId: String) -> String? {
        memberNames[memberId]
    }

    private func total(of invoices: [Invoice]) -> Int {
        invoices.reduce(0) { $0 + ($1.amountCents ?? 0) }
    }

    // MARK: - Laden

    /// Erststart über `.task` — lädt nur einmal, Reload macht `.refreshable`.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard !hasLoaded else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        if invoices.isEmpty { state = .loading }
        do {
            let loaded = try await api.invoices(clubId: clubId)
            invoices = loaded.sorted { lhs, rhs in
                // Höchste Mahnstufe zuerst, innerhalb der Stufe älteste
                // Fälligkeit oben (Strings sortieren lexikografisch korrekt).
                if lhs.dunningLevel != rhs.dunningLevel {
                    return lhs.dunningLevel > rhs.dunningLevel
                }
                return (lhs.dueOn ?? lhs.createdAt) < (rhs.dueOn ?? rhs.createdAt)
            }
            hasLoaded = true
            state = .loaded
        } catch {
            state = .error(message(for: error))
        }
        // Namen sind Beiwerk: Schlägt /members fehl (z. B. RLS der Rolle),
        // zeigt die Liste eben „Mitglied“ + Rechnungsnummer — kein Grund,
        // den ganzen Screen zu kippen.
        if state == .loaded {
            await loadMemberNames(api: api, clubId: clubId)
        }
    }

    private func loadMemberNames(api: APIClient, clubId: String) async {
        guard let members = try? await api.members(clubId: clubId) else { return }
        memberNames = Dictionary(
            members.map { ($0.id, "\($0.firstName) \($0.lastName)") },
            uniquingKeysWith: { first, _ in first }
        )
    }

    // MARK: - Mahnlauf (Vorschau)

    /// POST /clubs/{id}/dunning/run mit `dry_run: true` — 403 (kein
    /// Kassenwart/Vorstand) wird als freundlicher Hinweis gemappt.
    func runDunningPreview(api: APIClient, clubId: String) async {
        guard dunningState != .running else { return }
        dunningState = .running
        do {
            let result = try await api.dunningRun(
                clubId: clubId,
                DunningRunRequest(dryRun: true)
            )
            dunningState = .idle
            dunningResult = result
        } catch {
            if case APIError.problem(let problem) = error, problem.status == 403 {
                dunningState = .forbidden
            } else {
                dunningState = .error(message(for: error))
            }
        }
    }

    // MARK: - Fehlertexte

    private func message(for error: Error) -> String {
        if case APIError.problem(let problem) = error, problem.status == 403 {
            return String(localized: "finance.error.forbidden")
        }
        return (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
