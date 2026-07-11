import Foundation

/// Ebene, aus der das Soll eines Mitglieds abgeleitet wurde (Web: `SollLevel`).
/// Kaskade (migration 0010): Mitgliedsregel schlägt Teamregel schlägt
/// Vereinsregel; nur die Gewinner-Ebene zählt, Regeln DERSELBEN Ebene werden
/// summiert.
enum DutySollLevel: Equatable {
    case member, team, club, none
}

/// Fortschritt eines Mitglieds: Soll, Ist (gesamt/genehmigt), Rest, erfüllt.
/// Web-Referenz: apps/web/app/(portal)/pflichtstunden/logic.ts (`computeProgress`).
struct DutyProgress: Equatable {
    var soll: Double
    var ist: Double
    var istApproved: Double
    /// Anzahl noch nicht genehmigter Einträge.
    var pending: Int
    /// max(0, Soll − Ist).
    var rest: Double
    /// Soll gesetzt UND vollständig geleistet.
    var fulfilled: Bool
    var level: DutySollLevel
    var seasonLabel: String?

    /// Es gibt ein aktives Soll (> 0) — sonst zeigt die Karte den Hinweiszustand.
    var hasSoll: Bool { soll > 0 }

    /// Balken-Füllung 0…1 (nur sinnvoll bei `hasSoll`).
    var fraction: Double {
        guard soll > 0 else { return 0 }
        return min(max(ist / soll, 0), 1)
    }

    static let zero = DutyProgress(
        soll: 0, ist: 0, istApproved: 0, pending: 0,
        rest: 0, fulfilled: false, level: .none, seasonLabel: nil
    )
}

/// „Meine Stunden“ — lädt Soll (duty_requirements) + eigene Ist-Einträge
/// (duty_entries des angemeldeten Mitglieds) und rechnet daraus den Fortschritt.
/// Die Team-Zuordnung fürs Soll kommt aus dem eigenen `ClubMember` (best effort);
/// scheitert der Mitglieder-Call (RLS), greifen nur Vereins-/Mitgliedsregeln.
/// Durchsetzung bleibt serverseitig (RLS/DB-Trigger, 403 → Klartext).
@MainActor
final class DutyHoursViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var entries: [DutyEntry] = []
    @Published private(set) var progress: DutyProgress = .zero
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// die Karte durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var memberId: String?
    private var myTeamIds: [String] = []
    private var requirements: [DutyRequirement] = []
    private var hasLoadedOnce = false

    /// Eigene Einträge, neueste zuerst (Datum absteigend, bei Gleichstand
    /// nach Erfassungszeit). ISO-8601 gleicher Form sortiert lexikografisch.
    var sortedEntries: [DutyEntry] {
        entries.sorted { lhs, rhs in
            lhs.activityDate != rhs.activityDate
                ? lhs.activityDate > rhs.activityDate
                : lhs.createdAt > rhs.createdAt
        }
    }

    // MARK: - Laden

    /// Erststart aus `.task` — `SessionStore` ist erst im View-Environment da,
    /// deshalb kommen `api`/`clubId`/`memberId` hier rein.
    func loadIfNeeded(api: APIClient, clubId: String, memberId: String) async {
        self.api = api
        self.clubId = clubId
        self.memberId = memberId
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async { await load(showLoadingState: true) }

    /// Pull-to-Refresh: kein Lade-Screen, Fehler nur als Alert.
    func refresh() async { await load(showLoadingState: false) }

    private func load(showLoadingState: Bool) async {
        guard let api, let clubId, let memberId, !memberId.isEmpty else { return }
        if showLoadingState { state = .loading }
        do {
            async let requirementsCall = api.listDutyRequirements(clubId: clubId)
            async let entriesCall = api.listDutyEntries(clubId: clubId, memberId: memberId)
            // Mitglieder nur, um die eigenen Team-IDs für die Soll-Kaskade
            // aufzulösen — ein RLS-403 darf die Stunden nicht verhindern.
            async let membersCall = api.members(clubId: clubId)

            let requirements = try await requirementsCall
            let entries = try await entriesCall
            let members = (try? await membersCall) ?? []

            if let me = members.first(where: { $0.id == memberId }) {
                self.myTeamIds = me.teamIds
            }
            self.requirements = requirements
            self.entries = entries
            recompute()
            state = .loaded
        } catch {
            let message = Self.friendlyMessage(error)
            if state == .loaded, !showLoadingState {
                refreshErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }

    // MARK: - Optimistischer Einschub

    /// Neu erfassten Eintrag (mit echter ID) einfügen und Fortschritt neu
    /// rechnen — gleiche ID ersetzt statt zu doppeln.
    func insert(created entry: DutyEntry) {
        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = entry
        } else {
            entries.append(entry)
        }
        recompute()
    }

    private func recompute() {
        guard let memberId else { return }
        progress = Self.computeProgress(
            memberId: memberId,
            teamIds: myTeamIds,
            requirements: requirements,
            entries: entries
        )
    }

    // MARK: - Reine Fachlogik (Web-Parität: logic.ts)

    static func computeProgress(
        memberId: String,
        teamIds: [String],
        requirements: [DutyRequirement],
        entries: [DutyEntry]
    ) -> DutyProgress {
        let (soll, level, seasonLabel) = resolveSoll(
            memberId: memberId, teamIds: teamIds, requirements: requirements
        )
        let ist = entries.reduce(0) { $0 + ($1.hours ?? 0) }
        let istApproved = entries.filter(\.approved).reduce(0) { $0 + ($1.hours ?? 0) }
        let pending = entries.filter { !$0.approved }.count
        let rest = max(0, soll - ist)
        let fulfilled = soll > 0 && ist >= soll
        return DutyProgress(
            soll: soll, ist: ist, istApproved: istApproved, pending: pending,
            rest: rest, fulfilled: fulfilled, level: level, seasonLabel: seasonLabel
        )
    }

    /// Effektives Soll über die Kaskade (spezifischste Ebene gewinnt; Regeln
    /// derselben Ebene summieren). Web-Referenz: `resolveMemberSoll`.
    static func resolveSoll(
        memberId: String,
        teamIds: [String],
        requirements: [DutyRequirement]
    ) -> (hours: Double, level: DutySollLevel, seasonLabel: String?) {
        let memberReqs = requirements.filter { $0.memberId == memberId }
        let teamReqs = requirements.filter { req in
            guard req.memberId == nil, let teamId = req.teamId else { return false }
            return teamIds.contains(teamId)
        }
        let clubReqs = requirements.filter { $0.memberId == nil && $0.teamId == nil }

        let chosen: [DutyRequirement]
        let level: DutySollLevel
        if !memberReqs.isEmpty {
            chosen = memberReqs; level = .member
        } else if !teamReqs.isEmpty {
            chosen = teamReqs; level = .team
        } else if !clubReqs.isEmpty {
            chosen = clubReqs; level = .club
        } else {
            chosen = []; level = .none
        }

        let hours = chosen.reduce(0) { $0 + ($1.requiredHours ?? 0) }
        let seasonLabel = chosen.count == 1 ? chosen[0].seasonLabel : nil
        return (hours, level, seasonLabel)
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
