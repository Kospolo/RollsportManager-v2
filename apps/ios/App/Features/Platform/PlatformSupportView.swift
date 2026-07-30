import SwiftUI

/// Betreiber-Sicht „Support": Anfragen aller Vereine.
/// Web-Referenz: apps/web/app/(super)/support-tickets.
///
/// Sortiert wie im Web nach Dringlichkeit des Wartens: offene und auf den
/// Betreiber wartende Tickets zuerst, geschlossene zuletzt. Wer unterwegs in
/// die Konsole schaut, will genau eine Antwort — „muss ich jetzt ran?".
///
/// Ein Tipp auf eine Karte öffnet den Verlauf (`PlatformSupportThreadView`) — dort
/// kann der Betreiber ANTWORTEN (`POST /support/tickets/{id}/messages`) und
/// Status/Dringlichkeit setzen (`PATCH /support/tickets/{id}`), club-scoped und ohne
/// „Verein betreten" (Spiegel TicketThread.tsx unter /super). Diese Liste selbst
/// bleibt reine Übersicht.
struct PlatformSupportView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PlatformSectionModel<[SupportTicket]>()

    var body: some View {
        PlatformSectionScreen(
            title: "platform.support.title",
            model: model,
            fetch: { try await session.api.listPlatformSupportTickets() },
            isEmpty: { $0.isEmpty },
            emptyImage: "lifepreserver",
            emptyTitle: "platform.support.empty.title",
            emptyMessage: "platform.support.empty.message"
        ) { tickets in
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                let sorted = Self.sorted(tickets)
                let waiting = sorted.filter { Self.needsOperator($0) }.count
                banner(waiting: waiting, total: tickets.count)
                ForEach(sorted, id: \.id) { ticket in
                    NavigationLink {
                        PlatformSupportThreadView(ticketId: ticket.id)
                    } label: {
                        ticketCard(ticket)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint(Text("platform.support.open.a11y"))
                }
            }
        }
    }

    /// Die eine Zahl zuerst: wie viele warten auf den Betreiber.
    private func banner(waiting: Int, total: Int) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: waiting > 0 ? "bell.badge.fill" : "checkmark.circle.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(waiting > 0 ? Theme.Colors.warn : Theme.Colors.success)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(waiting > 0
                         ? "platform.support.waiting \(waiting)"
                         : "platform.support.allHandled")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("platform.support.total \(total)")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func ticketCard(_ ticket: SupportTicket) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text(verbatim: ticket.subject)
                    .font(Theme.Fonts.listTitle)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                // Chips brechen bei grosser Schrift in mehrere Zeilen um —
                // nebeneinander bliebe vom Status nur ein Buchstabe.
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: Theme.Spacing.s2) { pills(ticket) }
                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) { pills(ticket) }
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    PlatformDetailRow(
                        label: "platform.support.club",
                        value: PlatformFormat.text(ticket.clubName)
                    )
                    PlatformDetailRow(
                        label: "platform.support.createdBy",
                        value: PlatformFormat.text(ticket.createdByName)
                    )
                    PlatformDetailRow(
                        label: "platform.support.messages",
                        value: Text(verbatim: ticket.messageCount.formatted(.number)),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.support.lastReply",
                        value: PlatformFormat.dateTime(ticket.lastReplyAt ?? ticket.createdAt)
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func pills(_ ticket: SupportTicket) -> some View {
        RSMStatusPill(text: Self.statusKey(ticket.status), kind: Self.statusKind(ticket.status))
        RSMStatusPill(
            text: Self.priorityKey(ticket.priority),
            kind: Self.priorityKind(ticket.priority)
        )
        if Self.needsOperator(ticket) {
            RSMStatusPill(text: "platform.support.pill.needsUs", kind: .warn)
        }
    }

    // MARK: - Regeln

    /// „Wir sind dran": nicht geschlossen UND die letzte Wortmeldung kam vom
    /// Verein. `waiting_on_club` bedeutet umgekehrt: der Ball liegt dort.
    static func needsOperator(_ ticket: SupportTicket) -> Bool {
        ticket.status != .closed
            && ticket.status != .waitingOnClub
            && ticket.lastReplyBy == .club
    }

    /// Wartende zuerst, dann offene, geschlossene ganz nach hinten; innerhalb
    /// gleicher Dringlichkeit die zuletzt bewegten oben.
    static func sorted(_ tickets: [SupportTicket]) -> [SupportTicket] {
        tickets.sorted { lhs, rhs in
            let l = rank(lhs), r = rank(rhs)
            if l != r { return l < r }
            return (lhs.lastReplyAt ?? lhs.createdAt) > (rhs.lastReplyAt ?? rhs.createdAt)
        }
    }

    private static func rank(_ ticket: SupportTicket) -> Int {
        if ticket.status == .closed { return 3 }
        if needsOperator(ticket) { return 0 }
        if ticket.status == .waitingOnClub { return 2 }
        return 1
    }

    // MARK: - Beschriftungen

    static func statusKey(_ status: SupportTicketStatus) -> LocalizedStringKey {
        switch status {
        case .open: "platform.support.status.open"
        case .inProgress: "platform.support.status.inProgress"
        case .waitingOnClub: "platform.support.status.waitingOnClub"
        case .closed: "platform.support.status.closed"
        }
    }

    static func statusKind(_ status: SupportTicketStatus) -> RSMStatusKind {
        switch status {
        case .open: .info
        case .inProgress: .brand
        case .waitingOnClub: .neutral
        case .closed: .success
        }
    }

    static func priorityKey(_ priority: SupportTicketPriority) -> LocalizedStringKey {
        switch priority {
        case .low: "platform.support.priority.low"
        case .normal: "platform.support.priority.normal"
        case .high: "platform.support.priority.high"
        case .urgent: "platform.support.priority.urgent"
        }
    }

    static func priorityKind(_ priority: SupportTicketPriority) -> RSMStatusKind {
        switch priority {
        case .low, .normal: .neutral
        case .high: .warn
        case .urgent: .danger
        }
    }
}
