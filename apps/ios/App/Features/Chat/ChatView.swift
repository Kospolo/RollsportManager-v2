import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Chat-Features: die Kanalliste (Team-Kanäle +
/// Direktnachrichten mit letzter Nachricht). Ein Tipp öffnet den Thread.
///
/// Läuft im NavigationStack des „Mehr"-Tabs (eingehängt über `ChatRootView`),
/// erwartet `SessionStore` im Environment. Datenzugang ausschließlich über
/// `session.api` (Bearer via SessionStore).
struct ChatView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = ChatViewModel()

#if DEBUG
    /// Nur DEBUG-Smoke: `-devOpenFirstChannel YES` öffnet nach dem Laden den
    /// ersten Kanal-Thread. Gehalten als `rsmKey` (ChatChannel ist ein
    /// read-only Contract-Typ ohne Hashable). Kein Prod-Pfad.
    @State private var devThreadKey: String?
#endif

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                listView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("chat.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            // „Neue Ansage" nur für Vereins-Admins (Spiegel des Web-Buttons im
            // Listen-Header). Nicht-Admins sehen den Kanal read-only, sobald
            // Ansagen existieren. Die Berechtigung erzwingt der Server (RLS).
            if session.permissions.isClubAdmin {
                ToolbarItem(placement: .primaryAction) {
                    NavigationLink {
                        broadcastThread
                    } label: {
                        Label("chat.broadcast.new", systemImage: "bell.badge")
                    }
                    .accessibilityHint(Text("chat.broadcast.new.a11y"))
                }
            }
        }
#if DEBUG
        .navigationDestination(item: $devThreadKey) { key in
            if let channel = model.channels.first(where: { $0.rsmKey == key }) {
                ChatThreadView(
                    channel: channel,
                    api: session.api,
                    clubId: session.clubId,
                    myMemberId: model.myMemberId,
                    namesById: model.namesById,
                    isClubAdmin: session.permissions.isClubAdmin
                )
            }
        }
        .onChange(of: model.state) { _, newState in
            if case .loaded = newState,
               UserDefaults.standard.bool(forKey: "devOpenFirstChannel"),
               devThreadKey == nil {
                devThreadKey = model.channels.first?.rsmKey
            }
        }
#endif
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                myMemberId: session.session?.profile.memberId ?? ""
            )
        }
        .alert("chat.refresh.error.title", isPresented: refreshErrorBinding) {
            Button("chat.alert.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("chat.loading")
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
                    Text("chat.error.title")
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
    }

    // MARK: - Liste

    private var listView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if model.channels.isEmpty {
                    RSMCard {
                        RSMEmptyState(
                            systemImage: "bubble.left.and.bubble.right",
                            title: "chat.empty.title",
                            message: "chat.empty.message"
                        )
                    }
                } else {
                    RSMCard(padding: 0) {
                        VStack(spacing: 0) {
                            ForEach(model.channels, id: \.rsmKey) { channel in
                                channelLink(channel)
                                if channel.rsmKey != model.channels.last?.rsmKey {
                                    Divider()
                                        .overlay(Theme.Colors.line)
                                        .padding(.leading, Theme.Spacing.s4)
                                }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    private func channelLink(_ channel: ChatChannel) -> some View {
        NavigationLink {
            ChatThreadView(
                channel: channel,
                api: session.api,
                clubId: session.clubId,
                myMemberId: model.myMemberId,
                namesById: model.namesById,
                isClubAdmin: session.permissions.isClubAdmin
            )
        } label: {
            ChatChannelRow(
                channel: channel,
                currentMemberId: model.myMemberId,
                nameFor: model.name(for:)
            )
            .padding(.horizontal, Theme.Spacing.s4)
        }
        .buttonStyle(.plain)
    }

    /// Synthetischer Ansage-Kanal für den „Neue Ansage"-Einstieg (Spiegel des
    /// Web-`{channelType:'broadcast'}`). Erscheint zusätzlich regulär in der
    /// Liste, sobald der Server Ansagen liefert.
    private var broadcastThread: some View {
        ChatThreadView(
            channel: ChatChannel(channelType: .broadcast),
            api: session.api,
            clubId: session.clubId,
            myMemberId: model.myMemberId,
            namesById: model.namesById,
            isClubAdmin: session.permissions.isClubAdmin
        )
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
