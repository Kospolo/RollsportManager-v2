import Foundation
import SwiftUI

/// Zustand + Ladelogik des Features „Wartelisten“ (Web-Referenz:
/// /(portal)/wartelisten). Zwei Sichten aus EINER (RLS-gescopten) Response:
///  - „Meine Einträge“: jede:r sieht die eigenen Plätze und trägt sich selbst
///    ein/aus (`joinWaitlist`/`leaveWaitlist`).
///  - „Vereins-Warteschlange“: Trainer+ sehen alle Einträge des Vereins und
///    können sie entfernen. Sichtbarkeit ist Komfort — die Durchsetzung bleibt
///    serverseitig (403 → Klartext-Meldung, kein Zustandswechsel).
///
/// Pflicht-Call ist die Wartelisten-Liste (`GET /waitlists`). Mitglieder-
/// Stammdaten (`listMembers`, für Namen in der Queue) und Hallen/Ausrüstung
/// (`listFacilities`/`listEquipment`, zum Auflösen der Ziel-Labels) sind
/// best-effort: ihr Fehlschlag kippt nicht den ganzen Screen.
@MainActor
final class WaitlistsViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    // MARK: - Published State

    @Published private(set) var state: LoadState = .idle
    /// Alle sichtbaren Einträge (RLS-gescopt), bereits sortiert.
    @Published private(set) var entries: [Waitlist] = []
    /// Mitglieder nach ID — Namen/Avatare der Queue. Leer, wenn `listMembers`
    /// für die Rolle nicht sichtbar war (RLS).
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// Nachgeladene Ziel-Quellen (Hallen/Ausrüstung).
    @Published private(set) var targetSources = WaitlistTargetSources()

    /// Filter der Vereins-Warteschlange (nil = „Alle“).
    @Published var queueFilter: WaitlistKind?
    /// Laufende Schreibaktion (Join/Leave) — sperrt die Buttons.
    @Published private(set) var isMutating = false

    // MARK: - Kontext (vom View durchgereicht)

    private var api: APIClient?
    private var clubId: String = ""
    private var myMemberId: String = ""
    private(set) var myRole: ClubRole = .member

    /// Nur Trainer+ sehen die Vereins-Warteschlange.
    var canManageQueue: Bool { WaitlistAccess.canManageQueue(myRole) }

    // MARK: - Abgeleitete Listen

    /// Eigene Einträge (memberId == ich), sortiert.
    var myEntries: [Waitlist] {
        WaitlistDerive.sorted(entries.filter { $0.memberId == myMemberId })
    }

    /// Sichtbare Queue-Einträge nach aktivem Art-Filter, sortiert.
    var visibleQueue: [Waitlist] {
        let base = queueFilter.map { kind in entries.filter { $0.kind == kind } } ?? entries
        return WaitlistDerive.sorted(base)
    }

    /// Anzahl je Art (für die Filter-Chips inkl. „Alle“).
    var kindCounts: [WaitlistKind: Int] { WaitlistDerive.countByKind(entries) }

    func member(for entry: Waitlist) -> ClubMember? { membersById[entry.memberId] }

    // MARK: - Laden

    /// Erstladung über `.task` — lädt nur, wenn noch nichts da ist. Übernimmt
    /// dabei den Session-Kontext (Client, Verein, eigene Person + Rolle).
    func loadIfNeeded(session: SessionStore) async {
        adopt(session: session)
        guard state == .idle else { return }
        await reload()
    }

    func reload() async {
        guard let api else { return }
        state = .loading

        // Best-effort-Stammdaten parallel — Fehlschlag ⇒ nur reduzierte Labels.
        async let membersCall = api.listMembers(clubId: clubId)
        async let facilitiesCall = api.listFacilities(clubId: clubId)
        async let equipmentCall = api.listEquipment(clubId: clubId)

        if let roster = try? await membersCall {
            membersById = Dictionary(roster.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        }
        var sources = WaitlistTargetSources()
        if let facilities = try? await facilitiesCall {
            sources.facilitiesById = Dictionary(facilities.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        }
        if let equipment = try? await equipmentCall {
            sources.equipmentById = Dictionary(equipment.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        }
        targetSources = sources

        do {
            let list = try await api.listWaitlists(clubId: clubId)
            entries = WaitlistDerive.sorted(list)
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }
    }

    // MARK: - Schreiben

    /// Selbst-Eintrag in eine Warteliste (memberId = eigene Person). Erfolg:
    /// Liste neu laden + `true` zum Schließen des Dialogs. Fehler: Meldung
    /// setzen, `false` (Dialog bleibt offen). 403 → Klartext („nur selbst“).
    @discardableResult
    func join(kind: WaitlistKind, targetId: String?, note: String?) async -> Bool {
        guard let api, !isMutating else { return false }
        isMutating = true
        defer { isMutating = false }
        let input = WaitlistCreate(
            clubId: clubId,
            memberId: myMemberId,
            kind: kind,
            targetId: targetId?.isEmpty == false ? targetId : nil,
            note: note?.isEmpty == false ? note : nil
        )
        do {
            _ = try await api.joinWaitlist(input)
            await reload()
            return true
        } catch {
            actionError = Self.actionMessage(for: error, forbidden: "wartelisten.forbidden.join")
            return false
        }
    }

    /// Austragen/Entfernen (leaveWaitlist). Wird BEWUSST nur über den
    /// expliziten Bestätigungs-Klick aufgerufen — nie automatisch. 403 →
    /// Klartext („nur Trainer:innen“).
    func leave(_ entry: Waitlist) async {
        guard let api, !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            try await api.leaveWaitlist(id: entry.id)
            await reload()
        } catch {
            actionError = Self.actionMessage(for: error, forbidden: "wartelisten.forbidden.manage")
        }
    }

    /// Klartext-Meldung der letzten fehlgeschlagenen Schreibaktion (Alert).
    @Published var actionError: String?

    // MARK: - Helfer

    private func adopt(session: SessionStore) {
        api = session.api
        clubId = session.clubId
        if let profile = session.session?.profile {
            myMemberId = profile.memberId
            myRole = profile.clubRole
        }
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }

    /// Für Schreibaktionen: 403 wird zu einem freundlichen Rollen-Hinweis,
    /// alles andere bleibt die technische Fehlerbeschreibung.
    private static func actionMessage(for error: Error, forbidden key: String) -> String {
        if error.isForbiddenAPIError {
            return String(localized: String.LocalizationValue(key))
        }
        return message(for: error)
    }
}
