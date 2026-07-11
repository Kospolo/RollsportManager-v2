import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Pflichtstunden-Features („Meine Stunden“): oben
/// Soll/Ist der angemeldeten Person als Fortschrittsbalken + Rest, darunter die
/// eigenen Einträge (Datum · Stunden · Art · Status). Jedes Mitglied erfasst
/// seine Stunden selbst über „Stunden erfassen“ (POST /duty-entries). Läuft im
/// NavigationStack des „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/pflichtstunden.
struct DutyHoursView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = DutyHoursViewModel()
    @State private var isLogging = false

    private var memberId: String { session.session?.profile.memberId ?? "" }
    private var canLog: Bool { !memberId.isEmpty }

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                loadedView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("pflichtstunden.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if model.state == .loaded, canLog {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isLogging = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("pflichtstunden.log.a11y"))
                }
            }
        }
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                memberId: memberId
            )
#if DEBUG
            applyDutyHoursDevHooks()
#endif
        }
        .sheet(isPresented: $isLogging) {
            LogHoursSheet(
                api: session.api,
                clubId: session.clubId,
                memberId: memberId,
                onCreated: { model.insert(created: $0) }
            )
        }
        .alert("pflichtstunden.error.title", isPresented: refreshErrorBinding) {
            Button("pflichtstunden.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: `-devOpenLogHours YES` öffnet nach dem Laden das
    /// „Stunden erfassen“-Sheet (für Screenshots). Ohne das Flag nichts.
    private func applyDutyHoursDevHooks() {
        if UserDefaults.standard.bool(forKey: "devOpenLogHours"), canLog {
            isLogging = true
        }
    }
#endif

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("pflichtstunden.loading")
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
                    Text("pflichtstunden.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "pflichtstunden.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                    .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Geladen

    private var loadedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                MyHoursCard(progress: model.progress)
                entriesSection
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    @ViewBuilder
    private var entriesSection: some View {
        if model.entries.isEmpty {
            RSMCard {
                RSMEmptyState(
                    systemImage: "clock.badge.checkmark",
                    title: "pflichtstunden.list.empty.title",
                    message: "pflichtstunden.list.empty.body",
                    actionTitle: canLog ? "pflichtstunden.list.empty.cta" : nil,
                    action: canLog ? { isLogging = true } : nil
                )
            }
        } else {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(
                    eyebrow: "pflichtstunden.list.eyebrow",
                    title: "pflichtstunden.list.title"
                )
                .padding(.leading, Theme.Spacing.s1)
                ForEach(model.sortedEntries, id: \.id) { entry in
                    RSMCard(padding: Theme.Spacing.s4) {
                        DutyEntryRow(entry: entry)
                    }
                }
            }
        }
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
