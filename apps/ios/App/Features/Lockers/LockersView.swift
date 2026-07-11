import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Schließfächer-Features: das Fach-Inventar des
/// Vereins als Karten-Raster (Nummer/Kennung · Standort · Status · belegendes
/// Mitglied) mit Status-Filter (frei/belegt/defekt). Rein lesend in diesem
/// Batch. Läuft im NavigationStack des „Mehr“-Tabs; `SessionStore` kommt aus
/// dem Environment. Web-Referenz-UX: apps/web/app/(portal)/schliessfaecher.
struct LockersView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = LockersViewModel()

    /// Adaptiver Raster: eine Spalte auf dem iPhone, mehrere auf breiten
    /// Geräten (analog Web `sm:grid-cols-2 xl:grid-cols-3`).
    private let columns = [
        GridItem(.adaptive(minimum: 320, maximum: .infinity), spacing: Theme.Spacing.cardGap)
    ]

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
        .navigationTitle(Text("schliessfaecher.title"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .alert("schliessfaecher.error.refresh.title", isPresented: refreshErrorBinding) {
            Button("schliessfaecher.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("schliessfaecher.loading")
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
                    Text("schliessfaecher.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "schliessfaecher.error.retry") {
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

    // MARK: - Liste

    private var listView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if model.lockers.isEmpty {
                    RSMCard {
                        RSMEmptyState(
                            systemImage: "lock.square",
                            title: "schliessfaecher.empty.title",
                            message: "schliessfaecher.empty.message"
                        )
                    }
                } else {
                    filterChips
                    inventorySection
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    @ViewBuilder
    private var inventorySection: some View {
        let items = model.visibleLockers
        if items.isEmpty {
            RSMCard {
                RSMEmptyState(
                    systemImage: "line.3.horizontal.decrease.circle",
                    title: "schliessfaecher.filter.empty.title",
                    message: "schliessfaecher.filter.empty.message",
                    actionTitle: "schliessfaecher.filter.empty.cta",
                    action: { model.filter = .all }
                )
            }
        } else {
            LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.cardGap) {
                ForEach(items, id: \.id) { locker in
                    RSMCard {
                        LockerCardView(
                            locker: locker,
                            assignedMemberName: model.assignedMemberName(for: locker)
                        )
                    }
                }
            }
        }
    }

    // MARK: - Status-Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                chip(.all, label: Text("schliessfaecher.filter.all"))
                ForEach(LockerDisplay.order, id: \.self) { status in
                    chip(.status(status), label: Text(LockerDisplay.statusLabel(status)))
                }
            }
            .padding(.horizontal, Theme.Spacing.s1)
        }
    }

    private func chip(_ value: LockerStatusFilter, label: Text) -> some View {
        let selected = model.filter == value
        return Button {
            model.filter = value
        } label: {
            HStack(spacing: Theme.Spacing.s1) {
                label
                Text(verbatim: "\(model.count(for: value))")
                    .monospacedDigit()
                    .foregroundStyle(selected ? Theme.Colors.brandContrast.opacity(0.8) : Theme.Colors.inkFaint)
            }
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(selected ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .background(selected ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
