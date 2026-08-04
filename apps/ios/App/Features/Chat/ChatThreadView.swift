import SwiftUI

/// Nachrichten-Thread eines Kanals: Verlauf als Blasen (eigene rechts, fremde
/// links, in Team-Kanälen mit Absendername) und ein Eingabefeld unten.
/// Senden hängt optimistisch an; Aktualisieren via Pull-to-Refresh.
///
/// Wird von `ChatView` per NavigationLink im „Mehr"-Stack geöffnet.
/// Abhängigkeiten kommen explizit von der Liste (wie EventDetailSheet),
/// damit die View nicht selbst auf den Store zugreifen muss.
struct ChatThreadView: View {
    let channel: ChatChannel
    let api: APIClient
    let clubId: String
    let myMemberId: String
    /// member_id → Name (für Absender in Team-Kanälen).
    let namesById: [String: String]
    /// Vereins-Admin (owner/admin/moderator)? Steuert NUR die Anzeige: Composer
    /// im Ansage-Kanal + „Entfernen" an fremden Nachrichten. Die echte
    /// Berechtigung erzwingt der Server (RLS) — die UI ist nie die Grenze.
    /// Default `false`, damit bestehende Aufrufer read-only bleiben.
    var isClubAdmin: Bool = false

    @StateObject private var model = ChatThreadViewModel()
    @State private var draft = ""
    /// Fremde Nachricht, die der Admin gerade zu entfernen bestätigt (nil = kein
    /// Dialog). Nie automatisch bestätigt — Löschen nur über den Dialog-Button.
    @State private var toModerate: ChatMessage?
    /// Fremde Nachricht, die gerade gemeldet wird (nil = kein Sheet). Öffnet das
    /// „Nachricht melden"-Sheet; gemeldet wird nur über dessen Button.
    @State private var toReport: ReportTarget?

    /// Identifizierbare Hülle für `.sheet(item:)` — `ChatMessage` ist ein
    /// Contract-Typ (kein globales Identifiable), die ID kommt aus der Nachricht.
    private struct ReportTarget: Identifiable {
        let message: ChatMessage
        var id: String { message.id }
    }

    private static let bottomAnchor = "chat.thread.bottom"

    var body: some View {
        VStack(spacing: 0) {
            if channel.channelType == .broadcast { broadcastSubheader }
            content
            if showComposer {
                composer
            } else if broadcastReadOnly {
                readOnlyBar
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await model.loadIfNeeded(
                api: api,
                clubId: clubId,
                channel: channel,
                myMemberId: myMemberId
            )
        }
    }

    // MARK: - Inhalt (Zustände)

    @ViewBuilder private var content: some View {
        switch model.state {
        case .loading:
            loadingView
        case .error(let message):
            errorView(message)
        case .loaded:
            messagesView
        }
    }

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("chat.thread.loading")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    Text("chat.thread.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "chat.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Eine Nachrichtenblase samt Kontextmenü. „Melden" bietet jedes Mitglied an
    /// fremden, bereits gesendeten Nachrichten an; „Entfernen" nur der Admin in
    /// team/broadcast. Ohne Aktion bleibt die Blase ohne Menü — kein leeres
    /// Kontextmenü und keine No-op-VoiceOver-Aktion.
    @ViewBuilder
    private func messageRow(_ message: ChatMessage, at index: Int) -> some View {
        let isOwn = message.senderMemberId == model.myMemberId
        let bubble = ChatMessageBubble(
            message: message,
            isOwn: isOwn,
            senderName: senderName(for: message.senderMemberId),
            showSender: showSender(at: index)
        )
        // Entfernt der Admin die Blase, gleitet sie zur eigenen Seite aus
        // (fremde Nachricht = links).
        .transition(
            .opacity.combined(with: .move(edge: isOwn ? .trailing : .leading))
        )
        let mayReport = canReport(message)
        let mayModerate = canModerate(message)
        if mayReport || mayModerate {
            bubble
                // Long-Press (iOS-Standardgeste für Nachrichten)…
                .contextMenu { messageMenu(message, mayReport: mayReport, mayModerate: mayModerate) }
                // …UND als benannte VoiceOver-/Switch-Control-Aktionen.
                .accessibilityActions { messageA11yActions(message, mayReport: mayReport, mayModerate: mayModerate) }
        } else {
            bubble
        }
    }

    @ViewBuilder
    private func messageMenu(_ message: ChatMessage, mayReport: Bool, mayModerate: Bool) -> some View {
        if mayReport {
            Button {
                toReport = ReportTarget(message: message)
            } label: {
                Label { Text(verbatim: "Melden") } icon: { Image(systemName: "flag") }
            }
        }
        if mayModerate {
            Button(role: .destructive) {
                toModerate = message
            } label: {
                Label("chat.moderate", systemImage: "trash")
            }
        }
    }

    @ViewBuilder
    private func messageA11yActions(_ message: ChatMessage, mayReport: Bool, mayModerate: Bool) -> some View {
        if mayReport {
            Button { toReport = ReportTarget(message: message) } label: { Text(verbatim: "Melden") }
        }
        if mayModerate {
            Button { toModerate = message } label: { Text("chat.moderate") }
        }
    }

    private var messagesScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if model.messages.isEmpty {
                    emptyThread
                } else {
                    LazyVStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        ForEach(Array(model.messages.enumerated()), id: \.element.id) { index, message in
                            messageRow(message, at: index)
                        }
                        Color.clear
                            .frame(height: 1)
                            .id(Self.bottomAnchor)
                    }
                    .padding(Theme.Spacing.s4)
                }
            }
            .refreshable { await model.refresh() }
            .onChange(of: model.messages) {
                withAnimation(.easeOut(duration: Theme.Motion.standard)) {
                    proxy.scrollTo(Self.bottomAnchor, anchor: .bottom)
                }
            }
            .onChange(of: model.state) {
                guard model.state == .loaded else { return }
                DispatchQueue.main.async {
                    proxy.scrollTo(Self.bottomAnchor, anchor: .bottom)
                }
            }
        }
    }

    private var messagesView: some View {
        messagesScroll
        .alert("chat.refresh.error.title", isPresented: refreshErrorBinding) {
            Button("chat.alert.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
        .confirmationDialog(
            "chat.moderate.confirm.title",
            isPresented: moderateBinding,
            titleVisibility: .visible
        ) {
            Button("chat.moderate.confirm.action", role: .destructive) {
                let target = toModerate
                toModerate = nil
                _Concurrency.Task { await model.moderate(target) }
            }
            Button("chat.alert.cancel", role: .cancel) { toModerate = nil }
        } message: {
            Text("chat.moderate.confirm.body")
        }
        .alert("chat.moderate.error.title", isPresented: moderationErrorBinding) {
            Button("chat.alert.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.moderationErrorMessage ?? "")
        }
        .sheet(item: $toReport) { target in
            ReportMessageSheet(
                message: target.message,
                model: model,
                senderName: senderName(for: target.message.senderMemberId)
            )
        }
        .alert(Text(verbatim: "Meldung eingegangen"), isPresented: reportSuccessBinding) {
            Button("chat.alert.ok", role: .cancel) {}
        } message: {
            Text(verbatim: "Danke. Der Vorstand kümmert sich um deine Meldung.")
        }
    }

    private var emptyThread: some View {
        RSMEmptyState(
            systemImage: "bubble.left.and.bubble.right",
            title: "chat.thread.empty.title",
            message: emptyThreadMessage
        )
        .frame(maxWidth: .infinity, minHeight: 360)
    }

    private var emptyThreadMessage: LocalizedStringKey {
        switch channel.channelType {
        case .team:      return "chat.thread.empty.team"
        case .broadcast: return "chat.thread.empty.broadcast"
        case .direct:    return "chat.thread.empty.direct \(title)"
        }
    }

    // MARK: - Broadcast (Ansage-Kanal)

    /// Kontextzeile über der Nachrichtenliste (nur Broadcast): trägt den
    /// Web-Untertitel „Vereinsweite Ansage", den die NavigationBar nicht zeigt.
    private var broadcastSubheader: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "bell.fill")
                .imageScale(.medium)
                .accessibilityHidden(true)
            Text("chat.broadcast.subtitle")
        }
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.inkFaint)
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.s2)
        .background(Theme.Colors.bgSurface)
        .overlay(alignment: .bottom) {
            Divider().overlay(Theme.Colors.line)
        }
        .accessibilityElement(children: .combine)
    }

    /// Read-only-Leiste statt Composer: Mitglieder lesen Ansagen nur.
    private var readOnlyBar: some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.Colors.line)
            Text("chat.broadcast.readonly")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(Theme.Spacing.s3)
        }
        .background(Theme.Colors.bgSurface)
    }

    // MARK: - Eingabe

    private var composer: some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.Colors.line)
            HStack(alignment: .bottom, spacing: Theme.Spacing.s2) {
                TextField("chat.input.placeholder", text: $draft, axis: .vertical)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1...5)
                    .padding(.horizontal, Theme.Spacing.s3)
                    .padding(.vertical, Theme.Spacing.s2)
                    .background(Theme.Colors.bgSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    .accessibilityLabel(Text("chat.input.a11y"))
                sendButton
            }
            .padding(Theme.Spacing.s3)
        }
        .background(Theme.Colors.bgSurface)
        .alert("chat.send.error.title", isPresented: sendFailureBinding) {
            Button("chat.alert.ok", role: .cancel) {}
        } message: {
            sendFailureMessage
        }
    }

    private var sendButton: some View {
        Button(action: sendDraft) {
            Image(systemName: "arrow.up")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Colors.brandContrast)
                .frame(width: 40, height: 40)
                .background(canSend ? Theme.Colors.brand : Theme.Colors.lineStrong)
                .clipShape(Circle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(!canSend)
        .accessibilityLabel(Text("chat.send.a11y"))
    }

    private func sendDraft() {
        let text = draft
        draft = ""
        _Concurrency.Task {
            let ok = await model.send(text: text)
            if !ok { draft = text }
        }
    }

    // MARK: - Ableitungen

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !model.isSending
    }

    /// Darf im Ansage-Kanal geschrieben werden? Nur Admins — sonst read-only.
    private var canPostBroadcast: Bool {
        channel.channelType == .broadcast && isClubAdmin
    }

    private var showComposer: Bool {
        if case .error = model.state { return false }
        if channel.channelType == .broadcast { return canPostBroadcast }
        return true
    }

    /// Broadcast-Kanal ohne Schreibrecht (und kein Fehler) ⇒ Read-only-Leiste.
    private var broadcastReadOnly: Bool {
        if case .error = model.state { return false }
        return channel.channelType == .broadcast && !canPostBroadcast
    }

    /// Darf hier überhaupt moderiert werden? Admin in team/broadcast — nie in
    /// privaten Direktnachrichten (Spiegel MessageThread.tsx: canModerateHere).
    private var canModerateHere: Bool {
        isClubAdmin && channel.channelType != .direct
    }

    /// „Entfernen" nur an FREMDER, bereits gesendeter Nachricht.
    private func canModerate(_ message: ChatMessage) -> Bool {
        canModerateHere
            && message.senderMemberId != model.myMemberId
            && !message.id.hasPrefix("temp-")
    }

    /// „Melden" an FREMDER, bereits gesendeter Nachricht — für jedes Mitglied,
    /// unabhängig von Admin/Kanal (Spiegel MessageThread.tsx: `onReport`). Die
    /// eigene Nachricht meldet man nicht, optimistische (`temp-`) auch nicht.
    private func canReport(_ message: ChatMessage) -> Bool {
        message.senderMemberId != model.myMemberId
            && !message.id.hasPrefix("temp-")
    }

    private var title: String {
        let name = channel.rsmDisplayName
        if !name.isEmpty { return name }
        switch channel.channelType {
        case .team:      return String(localized: "chat.channel.team")
        case .direct:    return String(localized: "chat.channel.direct")
        case .broadcast: return String(localized: "chat.channel.broadcast")
        }
    }

    private func senderName(for memberId: String) -> String {
        let name = namesById[memberId] ?? ""
        return name.isEmpty ? String(localized: "chat.member") : name
    }

    /// Team- ODER Ansage-Kanal: Absendername über der ERSTEN Blase einer Folge
    /// desselben Absenders (nie bei eigenen Nachrichten). In Ansagen zeigt das,
    /// welches Vorstandsmitglied die Mitteilung verfasst hat (Web-Parität).
    private func showSender(at index: Int) -> Bool {
        let message = model.messages[index]
        let groupChannel = channel.channelType == .team || channel.channelType == .broadcast
        guard groupChannel, message.senderMemberId != model.myMemberId else {
            return false
        }
        if index == 0 { return true }
        return model.messages[index - 1].senderMemberId != message.senderMemberId
    }

    // MARK: - Alert-Bindungen

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }

    private var sendFailureBinding: Binding<Bool> {
        Binding(
            get: { model.sendFailure != nil },
            set: { if !$0 { model.sendFailure = nil } }
        )
    }

    private var moderateBinding: Binding<Bool> {
        Binding(
            get: { toModerate != nil },
            set: { if !$0 { toModerate = nil } }
        )
    }

    private var moderationErrorBinding: Binding<Bool> {
        Binding(
            get: { model.moderationErrorMessage != nil },
            set: { if !$0 { model.moderationErrorMessage = nil } }
        )
    }

    private var reportSuccessBinding: Binding<Bool> {
        Binding(
            get: { model.reportSuccess },
            set: { if !$0 { model.reportSuccess = false } }
        )
    }

    @ViewBuilder private var sendFailureMessage: some View {
        switch model.sendFailure {
        case .forbidden:
            Text("chat.send.error.forbidden")
        case .other(let message):
            Text(verbatim: message)
        case .none:
            EmptyView()
        }
    }
}
