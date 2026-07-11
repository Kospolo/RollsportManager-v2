import Foundation
import SwiftUI

/// Zustand der Rechnungs-Verwaltung: lädt Rechnungen + Mitglieder +
/// Kassenbuch-Kategorien über den APIClient und hält die optimistischen
/// Overlays für neu angelegte und status-geänderte Rechnungen. So bleibt die
/// Liste nach „anlegen/bezahlt/storniert" konsistent, ohne neu zu laden.
///
/// Rechte sind serverseitig verbindlich (RLS + 403). Der Sperr-Screen davor
/// (FinanceGuard) ist reine Menüführung; ein 403 hier wird zusätzlich als
/// freundlicher `forbidden`-Zustand aufgefangen (Defense-in-Depth).
@MainActor
final class InvoicesViewModel: ObservableObject {

    enum LoadState: Equatable {
        case loading
        case error(String)
        case forbidden
        case loaded
    }

    @Published private(set) var state: LoadState = .loading
    @Published var filter: InvoiceStatusFilter = .all
    @Published var query: String = ""
    @Published var selectedInvoice: Invoice?
    @Published var createOpen = false

    /// Von der Leitung geladen (Status-neutral — gefiltert wird im Client,
    /// damit die Chip-Zähler stimmen).
    @Published private(set) var baseInvoices: [Invoice] = []
    /// Neu angelegte Rechnungen — oben in der Liste, bis zum nächsten Reload.
    @Published private(set) var created: [Invoice] = []
    /// Status-Änderungen (bezahlt/storniert) als Overlay über Basis + Neu.
    @Published private(set) var patched: [String: Invoice] = [:]
    @Published private(set) var members: [ClubMember] = []
    @Published private(set) var memberNames: [String: String] = [:]
    @Published private(set) var categories: [LedgerCategory] = []

    private var hasLoaded = false

    // MARK: - Abgeleitete Werte

    /// Basis + Neu, überlagert von Status-Änderungen, frisch sortiert.
    var allInvoices: [Invoice] {
        let merged = (created + baseInvoices).map { patched[$0.id] ?? $0 }
        return InvoiceMath.sorted(merged)
    }

    /// Gefilterte + gesuchte Zeilen (Suche über Name ODER Rechnungsnummer).
    var rows: [Invoice] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        return allInvoices.filter { filter.matches($0) }.filter { invoice in
            guard !needle.isEmpty else { return true }
            let name = memberName(for: invoice.memberId)?.lowercased() ?? ""
            return name.contains(needle) || invoice.number.lowercased().contains(needle)
        }
    }

    /// Anzahl je Status über alle (ungefilterten) Rechnungen — für die Chips.
    func count(for filter: InvoiceStatusFilter) -> Int {
        allInvoices.filter { filter.matches($0) }.count
    }

    /// Summe der aktuell angezeigten Zeilen (aus DENSELBEN Datensätzen).
    var shownSumCents: Int { InvoiceMath.sumCents(rows) }
    var shownCount: Int { rows.count }
    var totalCount: Int { allInvoices.count }

    /// Währung von der Leitung (Seed: EUR) — für die Betragsformatierung.
    var currencyCode: String {
        allInvoices.first?.currency ?? "EUR"
    }

    /// Nur Einnahme-Kategorien — die Zahlung einer Rechnung bucht eine Einnahme.
    var incomeCategories: [LedgerCategory] {
        categories.filter { $0.kind == .income }
    }

    func member(for memberId: String) -> ClubMember? {
        members.first { $0.id == memberId }
    }

    func memberName(for memberId: String) -> String? {
        memberNames[memberId]
    }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard !hasLoaded else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        if baseInvoices.isEmpty { state = .loading }
        do {
            // Status-neutral laden (alle Status) — Filter/Chips arbeiten lokal.
            let loaded = try await api.listInvoices(clubId: clubId)
            baseInvoices = loaded
            // Overlays nach echtem Reload leeren: die Wahrheit steht jetzt
            // in `baseInvoices`, sonst überlagern veraltete Kopien.
            created = []
            patched = [:]
            hasLoaded = true
            state = .loaded
        } catch {
            state = mapLoad(error)
            return
        }
        // Beiwerk — schlägt es fehl, trägt die Liste eben Nummern statt Namen
        // bzw. bietet keine Kategorie-Auswahl. Kein Grund, den Screen zu kippen.
        await loadMembers(api: api, clubId: clubId)
        await loadCategories(api: api, clubId: clubId)
    }

    private func loadMembers(api: APIClient, clubId: String) async {
        guard let loaded = try? await api.members(clubId: clubId) else { return }
        members = loaded
        memberNames = Dictionary(
            loaded.map { ($0.id, "\($0.firstName) \($0.lastName)") },
            uniquingKeysWith: { first, _ in first }
        )
    }

    private func loadCategories(api: APIClient, clubId: String) async {
        guard let loaded = try? await api.listLedgerCategories(clubId: clubId) else { return }
        categories = loaded
    }

    // MARK: - Optimistische Overlays (aus den Sheets)

    /// Neu angelegte Rechnung nach oben übernehmen.
    func addCreated(_ invoice: Invoice) {
        created.insert(invoice, at: 0)
    }

    /// Status-Änderung (bezahlt/storniert) übernehmen und ggf. das Detail-Sheet
    /// auf den neuen Stand heben.
    func applyChange(_ invoice: Invoice) {
        patched[invoice.id] = invoice
        if selectedInvoice?.id == invoice.id {
            selectedInvoice = invoice
        }
    }

    // MARK: - Fehler-Mapping

    private func mapLoad(_ error: Error) -> LoadState {
        if case APIError.problem(let problem) = error, problem.status == 403 {
            return .forbidden
        }
        return .error((error as? APIError)?.errorDescription ?? error.localizedDescription)
    }
}
