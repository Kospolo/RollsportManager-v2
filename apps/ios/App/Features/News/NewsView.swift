import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des News-Features (Schwarzes Brett): Vereins-News als
/// Karten — angepinnt zuerst, dann nach Datum. Trainerstab (COACH_ROLES) kann
/// über „Nachricht verfassen“ eine News anlegen (Titel · Text · Pin). Läuft im
/// NavigationStack des „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/news.
struct NewsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = NewsViewModel()
    @State private var selection: NewsSelection?
    @State private var isComposing = false

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
        .navigationTitle(Text("news.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if model.canWrite {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isComposing = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("news.compose.a11y"))
                }
            }
        }
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                clubRole: session.session?.profile.clubRole
            )
#if DEBUG
            applyNewsDevHooks()
#endif
        }
        .sheet(isPresented: $isComposing) {
            NewNewsSheet(
                api: session.api,
                clubId: session.clubId,
                onCreated: { model.insert(created: $0) }
            )
        }
        .sheet(item: $selection) { selected in
            let item = latest(for: selected)
            NewsDetailSheet(news: item, authorName: model.authorName(for: item))
        }
        .alert("news.error.title", isPresented: refreshErrorBinding) {
            Button("news.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: `-devOpenComposeNews YES` öffnet nach dem Laden
    /// das „Nachricht verfassen“-Sheet (für Screenshots). Ohne das Flag nichts.
    private func applyNewsDevHooks() {
        if UserDefaults.standard.bool(forKey: "devOpenComposeNews"), model.canWrite {
            isComposing = true
        }
    }
#endif

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("news.loading")
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
                    Text("news.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "news.error.retry") {
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
                if model.items.isEmpty {
                    emptyState
                } else {
                    if !model.pinned.isEmpty {
                        section(titleKey: "news.section.pinned", items: model.pinned)
                    }
                    if !model.rest.isEmpty {
                        section(
                            titleKey: model.pinned.isEmpty ? nil : "news.section.more",
                            items: model.rest
                        )
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    @ViewBuilder
    private func section(titleKey: LocalizedStringKey?, items: [News]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            if let titleKey {
                Text(titleKey)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .padding(.leading, Theme.Spacing.s1)
            }
            ForEach(items, id: \.id) { item in
                RSMCard(padding: 0) {
                    NewsCardView(news: item, authorName: model.authorName(for: item)) {
                        selection = NewsSelection(news: item)
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "bell.badge",
                title: "news.empty.title",
                message: model.canWrite ? "news.empty.trainer" : "news.empty.member",
                actionTitle: model.canWrite ? "news.empty.cta" : nil,
                action: model.canWrite ? { isComposing = true } : nil
            )
        }
    }

    // MARK: - Helfer

    /// Fürs Sheet immer den aktuellsten Stand aus der Liste nehmen
    /// (die Auswahl ist nur ein Schnappschuss).
    private func latest(for selection: NewsSelection) -> News {
        model.items.first { $0.id == selection.news.id } ?? selection.news
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}

/// Sheet-Auswahl ohne `Identifiable`-Konformanz auf dem Contracts-Typ
/// (Konformanz-Kollisionen zwischen parallelen Feature-Teams vermeiden).
struct NewsSelection: Identifiable {
    let news: News
    var id: String { news.id }
}
