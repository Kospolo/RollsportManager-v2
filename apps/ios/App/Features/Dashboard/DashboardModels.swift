import Foundation

/// Ladezustand des Dashboards — ein Screen, drei klare Zustände.
enum DashboardLoadState {
    case loading
    case error(String)
    case loaded(DashboardData)
}

/// Antwort-Zusammenfassung eines Termins: Klartext-Zeile + Response-Balken.
/// „Vielleicht“ zählt als offen (unentschieden), „krank“ als Absage.
struct DashboardResponseSummary {
    let going: Int
    let declined: Int
    let open: Int
}

/// Aggregierte, fürs UI vorgerechnete Dashboard-Daten.
///
/// RLS-Hinweis: Rechnungen kommen rollenabhängig gefiltert von der API
/// (member sieht nur eigene, coach ggf. gar keine) — die Beitrags-KPI ist
/// deshalb bewusst neutral formuliert („aus deiner Sicht“), nie als
/// Vereins-Gesamtsumme verkauft.
struct DashboardData {
    let activeMemberCount: Int
    let openInvoiceCount: Int
    let openInvoiceSumCents: Int
    /// Termine im 14-Tage-Fenster, aufsteigend sortiert, Ende noch nicht vorbei.
    let upcomingEvents: [Event]
    var nextEvent: Event? { upcomingEvents.first }
    let nextCompetition: Competition?
    /// Kalendertage bis zum nächsten Wettkampf (0 = heute).
    let countdownDays: Int
    /// Gemeldete (nicht zurückgezogene) Mitglieder des nächsten Wettkampfs.
    let competitionEntrants: [ClubMember]
    /// Aufgaben: offene zuerst (nach Fälligkeit), erledigte hinten.
    var tasks: [Task]

    private let activeMembers: [ClubMember]

    init(
        members: [ClubMember],
        events: [Event],
        competitions: [Competition],
        invoices: [Invoice],
        tasks: [Task],
        now: Date = Date()
    ) {
        let calendar = Calendar.current
        let active = members.filter { $0.status == .active }
        activeMembers = active
        activeMemberCount = active.count

        let openInvoices = invoices.filter { $0.status == .open }
        openInvoiceCount = openInvoices.count
        openInvoiceSumCents = openInvoices.reduce(0) { $0 + ($1.amountCents ?? 0) }

        // Termine: nach Startzeit sortieren, bereits beendete ausblenden.
        upcomingEvents = events
            .compactMap { event -> (event: Event, start: Date)? in
                DashboardFormat.parseISO(event.startsAt).map { (event, $0) }
            }
            .filter { pair in
                let end = DashboardFormat.parseISO(pair.event.endsAt) ?? pair.start
                return end >= now
            }
            .sorted { $0.start < $1.start }
            .map(\.event)

        // Nächster Wettkampf: frühester, der noch bevorsteht oder läuft.
        let nextCompetitionPair = competitions
            .filter { $0.status == .upcoming || $0.status == .running }
            .compactMap { competition -> (competition: Competition, start: Date)? in
                DashboardFormat.parseISO(competition.startsAt).map { (competition, $0) }
            }
            .sorted { $0.start < $1.start }
            .first

        if let (competition, start) = nextCompetitionPair {
            nextCompetition = competition
            countdownDays = max(
                calendar.dateComponents(
                    [.day],
                    from: calendar.startOfDay(for: now),
                    to: calendar.startOfDay(for: start)
                ).day ?? 0,
                0
            )
            let membersById = Dictionary(
                members.map { ($0.id, $0) },
                uniquingKeysWith: { first, _ in first }
            )
            competitionEntrants = competition.entries
                .filter { $0.status != .withdrawn }
                .compactMap { membersById[$0.memberId] }
        } else {
            nextCompetition = nil
            countdownDays = 0
            competitionEntrants = []
        }

        // Aufgaben: offen vor erledigt, innerhalb offen nach Fälligkeit
        // (yyyy-MM-dd sortiert lexikographisch korrekt), ohne Datum hinten.
        self.tasks = tasks.sorted { lhs, rhs in
            if lhs.done != rhs.done { return !lhs.done }
            switch (lhs.dueOn, rhs.dueOn) {
            case let (left?, right?): return left < right
            case (_?, nil): return true
            case (nil, _?): return false
            default: return lhs.title < rhs.title
            }
        }
    }

    /// Zusagen/Absagen/offen für einen Termin. „Eingeladen“ sind die aktiven
    /// Mitglieder der Event-Teams (bzw. alle aktiven, wenn keine Teams gesetzt).
    func responseSummary(for event: Event) -> DashboardResponseSummary {
        let invitedCount: Int
        if event.teamIds.isEmpty {
            invitedCount = activeMembers.count
        } else {
            let eventTeams = Set(event.teamIds)
            invitedCount = activeMembers
                .filter { !eventTeams.isDisjoint(with: $0.teamIds) }
                .count
        }
        let going = event.rsvps.filter { $0.status == .going }.count
        let declined = event.rsvps.filter { $0.status == .declined || $0.status == .sick }.count
        let open = max(invitedCount - going - declined, 0)
        return DashboardResponseSummary(going: going, declined: declined, open: open)
    }
}
