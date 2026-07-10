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

    @StateObject private var model = ChatThreadViewModel()
    @State private var draft = ""

    private static let bottomAnchor = "chat.thread.bottom"

    var body: some View {
        VStack(spacing: 0) {
            content
            if showComposer { composer }
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

    private var messagesView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if model.messages.isEmpty {
                    emptyThread
                } else {
                    LazyVStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        ForEach(Array(model.messages.enumerated()), id: \.element.id) { index, message in
                            ChatMessageBubble(
                                message: message,
                                isOwn: message.senderMemberId == model.myMemberId,
                                senderName: senderName(for: message.senderMemberId),
                                showSender: showSender(at: index)
                            )
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
        .alert("chat.refresh.error.title", isPresented: refreshErrorBinding) {
            Button("chat.alert.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    private var emptyThread: some View {
        RSMEmptyState(
            systemImage: "bubble.left.and.bubble.right",
            title: "chat.thread.empty.title",
            message: channel.channelType == .team
                ? "chat.thread.empty.team"
                : "chat.thread.empty.direct \(title)"
        )
        .frame(maxWidth: .infinity, minHeight: 360)
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

    private var showComposer: Bool {
        if case .error = model.state { return false }
        return true
    }

    private var title: String {
        let name = channel.rsmDisplayName
        if !name.isEmpty { return name }
        return channel.channelType == .team
            ? String(localized: "chat.channel.team")
            : String(localized: "chat.channel.direct")
    }

    private func senderName(for memberId: String) -> String {
        let name = namesById[memberId] ?? ""
        return name.isEmpty ? String(localized: "chat.member") : name
    }

    /// Team-Kanal: Absendername über der ERSTEN Blase einer Folge desselben
    /// Absenders (nie bei eigenen Nachrichten).
    private func showSender(at index: Int) -> Bool {
        let message = model.messages[index]
        guard channel.channelType == .team, message.senderMemberId != model.myMemberId else {
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
