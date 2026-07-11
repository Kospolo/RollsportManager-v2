import Foundation
import SwiftUI

/// Lädt Kassenbuch, Kategorien und Mitgliedsnamen über den APIClient und hält
/// den Filter-Zustand. Schreiboperationen (Buchung anlegen, Storno) laufen als
/// eigene, isolierte Aktionen mit Klartext-Fehler — bei Erfolg wird neu geladen.
///
/// Rechte sind SERVERSEITIG (RLS + 403). Der Sperr-Screen (FinanceGuard) blendet
/// den ganzen Bereich für Mitglieder ohnehin aus; kommt trotzdem ein 403 (z. B.
/// Rollen-Rennen), zeigt der Screen den freundlichen Fehler.
@MainActor
final class CashbookViewModel: ObservableObject {

    enum LoadState: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: LoadState = .loading
    @Published private(set) var ledger: [LedgerEntry] = []
    @Published private(set) var categories: [LedgerCategory] = []
    /// member_id → Anzeigename; leer, falls /members für die Rolle tabu ist.
    @Published private(set) var memberNames: [String: String] = [:]
    /// alphabetisch sortierte Mitglieder für den Gegenpartei-Picker im Sheet.
    @Published private(set) var members: [ClubMember] = []

    @Published var categoryFilter: CashbookCategoryFilter = .all
    @Published var period: CashbookPeriod = .all

    /// Aktives Storno-Ziel (steuert das Sheet). `nil` = geschlossen.
    @Published var reverseTarget: LedgerEntry?
    /// Buchungs-Sheet sichtbar.
    @Published var showBookingSheet = false

    private var hasLoaded = false

    // MARK: - Abgeleitete Werte

    private var allRows: [CashbookRow] { CashbookDerive.buildRows(ledger) }

    var rows: [CashbookRow] {
        CashbookDerive.filterRows(allRows, category: categoryFilter, period: period)
    }

    var sums: CashbookSums { CashbookDerive.sumRows(rows) }

    var totalBalanceCents: Int { CashbookDerive.totalBalanceCents(ledger) }

    var isEmpty: Bool { ledger.isEmpty }

    var isFiltered: Bool { categoryFilter != .all || period != .all }

    /// Währung von der Leitung (Seed: EUR).
    var currencyCode: String { ledger.first?.currency ?? "EUR" }

    func memberName(for memberId: String?) -> String? {
        guard let memberId else { return nil }
        return memberNames[memberId]
    }

    func resetFilter() {
        categoryFilter = .all
        period = .all
    }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard !hasLoaded else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        if ledger.isEmpty { state = .loading }
        do {
            async let ledgerCall = api.listLedger(clubId: clubId)
            async let categoriesCall = api.listLedgerCategories(clubId: clubId)
            let (loadedLedger, loadedCategories) = try await (ledgerCall, categoriesCall)
            ledger = loadedLedger
            categories = loadedCategories.sorted {
                ($0.sortOrder ?? 0, $0.name) < ($1.sortOrder ?? 0, $1.name)
            }
            hasLoaded = true
            state = .loaded
        } catch {
            state = .error(message(for: error))
            return
        }
        // Namen sind Beiwerk: Schlägt /members fehl (RLS der Rolle), zeigt die
        // Liste eben die denormalisierte Gegenpartei — kein Grund, den ganzen
        // Screen zu kippen.
        await loadMembers(api: api, clubId: clubId)
    }

    private func loadMembers(api: APIClient, clubId: String) async {
        guard let loaded = try? await api.members(clubId: clubId) else { return }
        members = loaded.sorted {
            ($0.lastName, $0.firstName) < ($1.lastName, $1.firstName)
        }
        memberNames = Dictionary(
            loaded.map { ($0.id, "\($0.firstName) \($0.lastName)") },
            uniquingKeysWith: { first, _ in first }
        )
    }

    // MARK: - Buchung anlegen (POST /ledger)

    /// Legt eine Buchung an. Erfolg → neu laden + `true` (Sheet schließt).
    /// Fehler → wirft den Klartext, das Sheet bleibt offen.
    func createEntry(_ input: LedgerEntryCreate, api: APIClient, clubId: String) async throws {
        _ = try await api.createLedgerEntry(input)
        await load(api: api, clubId: clubId)
    }

    // MARK: - Storno (POST /ledger/{id}/reverse)

    /// Storniert eine Buchung (GoBD-Gegenbuchung). Erfolg → neu laden.
    /// 409 (bereits storniert / Storno eines Stornos) wirft weiter, damit das
    /// Sheet den ruhigen Klartext zeigt; der Aufrufer lädt danach neu.
    func reverseEntry(id: String, description: String?, api: APIClient, clubId: String) async throws {
        _ = try await api.reverseLedgerEntry(id: id, description: description)
        await load(api: api, clubId: clubId)
    }

    // MARK: - Fehlertexte

    private func message(for error: Error) -> String {
        if case APIError.problem(let problem) = error, problem.status == 403 {
            return String(localized: "kassenbuch.error.forbidden")
        }
        return (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
