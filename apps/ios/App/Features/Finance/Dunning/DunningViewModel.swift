import Foundation
import SwiftUI

/// Lädt offene Rechnungen + Mitglieder + Mahnprotokoll über den APIClient und
/// leitet daraus die KONSISTENTE Datenbasis (`items`) für KPI-Zeile, Ampel-
/// Gruppen und Mahnlauf ab. Rechte sind serverseitig (RLS): kommt ein 403,
/// zeigt der Screen einen ruhigen Sperr-Zustand statt eines Absturzes — der
/// FinanceGuard davor blendet ihn für Mitglieder ohnehin aus.
@MainActor
final class DunningViewModel: ObservableObject {

    enum LoadState: Equatable {
        case loading
        case forbidden
        case error(String)
        case loaded
    }

    /// Das Mahnprotokoll ist Beiwerk: schlägt es fehl (z. B. „not implemented"
    /// am Dev-Stack), kippt nicht der ganze Screen — die Karte zeigt es lokal.
    enum LogState: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: LoadState = .loading
    @Published private(set) var logState: LogState = .loading
    @Published private(set) var items: [DunningItem] = []
    @Published private(set) var log: [DunningLogEntry] = []

    /// Stand des Screens („Stand …") — beim Laden fixiert, damit Kopf und
    /// Überfälligkeits-Rechnung denselben Bezugspunkt haben.
    private(set) var asOf = Date()

    private var allInvoices: [Invoice] = []
    private var members: [ClubMember] = []
    private var membersById: [String: ClubMember] = [:]
    private var memberNamesById: [String: String] = [:]
    private var memberJoinYearById: [String: String] = [:]
    private var invoicesById: [String: Invoice] = [:]
    private var hasLoaded = false

    // MARK: - Abgeleitete Werte (eine Datenbasis für alles)

    var overdueItems: [DunningItem] { items.filter(\.overdue) }
    var stage2PlusItems: [DunningItem] { items.filter { $0.level >= 2 } }
    var handoverItems: [DunningItem] { items.filter { $0.level >= 3 } }

    var overdueTotalCents: Int { DunningDerive.sumCents(overdueItems) }
    var stage2PlusTotalCents: Int { DunningDerive.sumCents(stage2PlusItems) }
    var stages: [DunningStageBucket] { DunningDerive.groupByStage(items) }

    var currencyCode: String {
        items.first?.invoice.currency ?? allInvoices.first?.currency ?? "EUR"
    }

    func memberName(for memberId: String) -> String? { memberNamesById[memberId] }
    func member(id: String) -> ClubMember? { membersById[id] }
    func invoice(id: String) -> Invoice? { invoicesById[id] }

    /// Absender:in der Mahn-E-Mails: Kassenwart:in, sonst erste bekannte Person.
    var sender: ClubMember? {
        members.first { $0.role == .treasurer } ?? members.first
    }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard !hasLoaded else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        if allInvoices.isEmpty { state = .loading }
        asOf = Date()
        do {
            let invoices = try await api.listInvoices(clubId: clubId)
            allInvoices = invoices
            invoicesById = Dictionary(invoices.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            await loadMembers(api: api, clubId: clubId)
            rebuildItems()
            hasLoaded = true
            state = .loaded
        } catch {
            state = mapLoad(error)
        }
        if state == .loaded {
            await loadLog(api: api, clubId: clubId)
        }
    }

    /// Nach einem scharfen Mahnlauf: Rechnungen (neue Stufen) UND Protokoll neu.
    func reloadAfterApply(api: APIClient, clubId: String) async {
        await load(api: api, clubId: clubId)
    }

    private func loadMembers(api: APIClient, clubId: String) async {
        // Namen/Beitrittsjahre sind Beiwerk — RLS kann /members für die Rolle
        // sperren; dann trägt die Rechnungsnummer die Zeile.
        guard let loaded = try? await api.members(clubId: clubId) else { return }
        members = loaded
        membersById = Dictionary(loaded.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        memberNamesById = Dictionary(
            loaded.map { ($0.id, "\($0.firstName) \($0.lastName)") },
            uniquingKeysWith: { first, _ in first }
        )
        memberJoinYearById = Dictionary(
            loaded.compactMap { member -> (String, String)? in
                guard let joined = member.joinedOn, joined.count >= 4 else { return nil }
                return (member.id, String(joined.prefix(4)))
            },
            uniquingKeysWith: { first, _ in first }
        )
    }

    private func rebuildItems() {
        items = DunningDerive.buildItems(
            invoices: allInvoices,
            memberName: { [memberNamesById] in memberNamesById[$0] },
            memberJoinYear: { [memberJoinYearById] in memberJoinYearById[$0] },
            asOf: asOf
        )
    }

    // MARK: - Mahnprotokoll

    func loadLog(api: APIClient, clubId: String) async {
        if log.isEmpty { logState = .loading }
        do {
            let entries = try await api.listDunningLog(clubId: clubId)
            // Newest first — der Dev-Stack sortiert nicht garantiert.
            log = entries.sorted { $0.createdAt > $1.createdAt }
            logState = .loaded
        } catch {
            logState = .error((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    // MARK: - Fehlertexte

    private func mapLoad(_ error: Error) -> LoadState {
        if error.isForbiddenAPIError { return .forbidden }
        return .error((error as? APIError)?.errorDescription ?? error.localizedDescription)
    }
}
