import SwiftUI

/// Ein Support-Ticket samt Verlauf — die Betreiber-Sicht zum HANDELN.
/// Spiegel von apps/web/app/(super)/support-tickets/TicketThread.tsx.
///
/// Lädt `GET /support/tickets/{id}`, zeigt den Verlauf, und erlaubt:
///   • Antworten  → `POST /support/tickets/{id}/messages`
///   • Status/Dringlichkeit → `PATCH /support/tickets/{id}` (Betreiber-Vorbehalt)
///
/// `author_kind` schickt der Client NIE mit — der Server leitet die Seite aus dem
/// Token ab. Deshalb gibt es hier auch kein „als … antworten"-Feld: es gäbe eine
/// Wahl vor, die es nicht gibt. Diese Aktionen sind club-scoped und brauchen KEINEN
/// „Verein betreten"-Kontext (der Server erlaubt platform-admin und loggt gegen die
/// Ticket-Club, Migration 0052).
struct PlatformSupportThreadView: View {
    let ticketId: String

    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PlatformSectionModel<SupportTicketDetail>()

    @State private var replyBody = ""
    @State private var busy = false
    @State private var actionError: String?

    private func fetch() async throws -> SupportTicketDetail {
        try await session.api.getSupportTicket(id: ticketId)
    }

    var body: some View {
        PlatformSectionScreen(
            title: "platform.support.thread.title",
            model: model,
            fetch: fetch
        ) { ticket in
            content(ticket)
        }
    }

    // MARK: - Inhalt

    private func content(_ ticket: SupportTicketDetail) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            headerCard(ticket)
            statusCard(ticket)
            threadCard(ticket)
            if ticket.status == .closed {
                closedNote
            } else {
                replyCard(ticket)
            }
            if let actionError {
                errorLine(actionError)
            }
        }
    }

    private func headerCard(_ ticket: SupportTicketDetail) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("platform.support.thread.eyebrow")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
                Text(verbatim: ticket.subject)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(verbatim: ticket.clubName ?? ticket.clubId)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: Theme.Spacing.s2) { pills(ticket) }
                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) { pills(ticket) }
                }
                .padding(.top, Theme.Spacing.s1)
            }
        }
    }

    @ViewBuilder
    private func pills(_ ticket: SupportTicketDetail) -> some View {
        RSMStatusPill(
            text: PlatformSupportView.statusKey(ticket.status),
            kind: PlatformSupportView.statusKind(ticket.status)
        )
        RSMStatusPill(
            text: PlatformSupportView.priorityKey(ticket.priority),
            kind: PlatformSupportView.priorityKind(ticket.priority)
        )
    }

    // MARK: - Status / Dringlichkeit (Betreiber-Vorbehalt)

    private func statusCard(_ ticket: SupportTicketDetail) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                menuRow(
                    label: "platform.support.thread.setStatus",
                    current: PlatformSupportView.statusKey(ticket.status)
                ) {
                    ForEach(SupportTicketStatus.allCases, id: \.self) { s in
                        Button {
                            _Concurrency.Task { await setStatus(ticket, s) }
                        } label: {
                            statusMenuLabel(s, selected: s == ticket.status)
                        }
                    }
                }
                menuRow(
                    label: "platform.support.thread.setPriority",
                    current: PlatformSupportView.priorityKey(ticket.priority)
                ) {
                    ForEach(SupportTicketPriority.allCases, id: \.self) { p in
                        Button {
                            _Concurrency.Task { await setPriority(ticket, p) }
                        } label: {
                            priorityMenuLabel(p, selected: p == ticket.priority)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func statusMenuLabel(_ s: SupportTicketStatus, selected: Bool) -> some View {
        if selected {
            Label(PlatformSupportView.statusKey(s), systemImage: "checkmark")
        } else {
            Text(PlatformSupportView.statusKey(s))
        }
    }

    @ViewBuilder
    private func priorityMenuLabel(_ p: SupportTicketPriority, selected: Bool) -> some View {
        if selected {
            Label(PlatformSupportView.priorityKey(p), systemImage: "checkmark")
        } else {
            Text(PlatformSupportView.priorityKey(p))
        }
    }

    private func menuRow<Content: View>(
        label: LocalizedStringKey,
        current: LocalizedStringKey,
        @ViewBuilder menu: () -> Content
    ) -> some View {
        HStack(spacing: Theme.Spacing.s3) {
            Text(label)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
            Spacer(minLength: Theme.Spacing.s2)
            Menu {
                menu()
            } label: {
                HStack(spacing: Theme.Spacing.s1) {
                    Text(current)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .padding(.horizontal, Theme.Spacing.s3)
                .frame(minHeight: Theme.Size.touchTarget)
                .background(Theme.Colors.bgCanvas)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Theme.Colors.line, lineWidth: 1))
            }
            .disabled(busy)
        }
    }

    // MARK: - Verlauf

    private func threadCard(_ ticket: SupportTicketDetail) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                ForEach(ticket.messages, id: \.id) { message in
                    bubble(message)
                }
                Text("platform.support.thread.appendOnly")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// Betreiber-Nachrichten tragen NIE einen Personennamen (der Server liefert
    /// keinen) — „Support-Team" ist deshalb keine Beschönigung, sondern genau das,
    /// was da steht.
    private func bubble(_ message: SupportMessage) -> some View {
        let fromPlatform = message.authorKind == .platform
        return VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            HStack(spacing: Theme.Spacing.s2) {
                Label {
                    if fromPlatform {
                        Text("platform.support.thread.supportTeam")
                    } else {
                        Text(verbatim: message.authorName ?? String(localized: "platform.support.thread.byClub"))
                    }
                } icon: {
                    Image(systemName: fromPlatform ? "rectangle.on.rectangle" : "person.2.fill")
                }
                .font(Theme.Fonts.caption.weight(.bold))
                .foregroundStyle(Theme.Colors.inkPrimary)
                Spacer(minLength: Theme.Spacing.s2)
                PlatformFormat.dateTime(message.createdAt)
                    .font(Theme.Fonts.monoCaption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            Text(verbatim: message.body)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Theme.Spacing.s3)
        .background(fromPlatform ? Theme.Colors.brandSoft : Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    // MARK: - Antworten

    private func replyCard(_ ticket: SupportTicketDetail) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("platform.support.thread.replyLabel")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                TextField(
                    "platform.support.thread.replyPlaceholder",
                    text: $replyBody,
                    axis: .vertical
                )
                .lineLimit(3...8)
                .textFieldStyle(.plain)
                .padding(Theme.Spacing.s3)
                .background(Theme.Colors.bgCanvas)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                        .stroke(Theme.Colors.line, lineWidth: 1)
                )
                .disabled(busy)

                RSMPrimaryButton(
                    title: busy ? "platform.support.thread.sending" : "platform.support.thread.send",
                    isLoading: busy
                ) {
                    _Concurrency.Task { await send(ticket) }
                }
                .disabled(replyBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy)

                Text("platform.support.thread.noMail")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var closedNote: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            Label("platform.support.thread.closedNote", systemImage: "lock.fill")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func errorLine(_ message: String) -> some View {
        Label {
            Text(verbatim: message)
        } icon: {
            Image(systemName: "exclamationmark.triangle.fill")
        }
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.danger)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Aktionen

    private func send(_ ticket: SupportTicketDetail) async {
        let text = replyBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !busy else { return }
        busy = true
        actionError = nil
        defer { busy = false }
        do {
            _ = try await session.api.replySupportTicket(id: ticket.id, SupportMessageCreate(body: text))
            replyBody = ""
            await model.load(fetch)
        } catch {
            actionError = message(for: error)
        }
    }

    private func setStatus(_ ticket: SupportTicketDetail, _ status: SupportTicketStatus) async {
        guard status != ticket.status, !busy else { return }
        busy = true
        actionError = nil
        defer { busy = false }
        do {
            _ = try await session.api.updateSupportTicket(id: ticket.id, SupportTicketUpdate(status: status))
            await model.load(fetch)
        } catch {
            actionError = message(for: error)
        }
    }

    private func setPriority(_ ticket: SupportTicketDetail, _ priority: SupportTicketPriority) async {
        guard priority != ticket.priority, !busy else { return }
        busy = true
        actionError = nil
        defer { busy = false }
        do {
            _ = try await session.api.updateSupportTicket(id: ticket.id, SupportTicketUpdate(priority: priority))
            await model.load(fetch)
        } catch {
            actionError = message(for: error)
        }
    }

    private func message(for error: Error) -> String {
        if error.isForbiddenAPIError {
            return String(localized: "platform.support.thread.forbidden")
        }
        return (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
