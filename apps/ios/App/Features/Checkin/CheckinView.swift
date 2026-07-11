import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Check-in-Features (QR-Ersatz nativ): oben „Mein
/// QR-Code" zum Vorzeigen, das Selbst-Einchecken für den heutigen/nächsten
/// Termin und die eigene Historie — Selbst-Service für jedes Mitglied. Der
/// Trainerstab sieht zusätzlich das manuelle Einchecken eines Mitglieds und die
/// Vereins-Historie inkl. Kennzahlen. Sichtbarkeit ist Komfort — die
/// verbindliche Durchsetzung bleibt serverseitig (RLS/Rollencheck; 403 →
/// Hinweis). Läuft im NavigationStack des „Mehr"-Tabs; `SessionStore` kommt aus
/// dem Environment. Web-Referenz-UX: apps/web/app/(portal)/checkin.
struct CheckinView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = CheckinViewModel()

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                content
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("module.checkin.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await model.loadIfNeeded(session: session) }
        .alert("checkin.error.title", isPresented: refreshErrorBinding) {
            Button("checkin.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Inhalt

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                CheckinQrCard(
                    clubId: model.myClubId,
                    memberId: model.myMemberId,
                    displayName: model.myDisplayName
                )

                SelfCheckinCard(model: model)

                mySection

                if model.isTrainer {
                    TrainerCheckinCard(model: model)
                    ClubCheckinsSection(model: model)
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    private var mySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            CheckinSectionHeader(title: "checkin.history.title", subtitle: "checkin.history.sub")
            CheckinList(
                entries: model.myCheckins,
                showMemberName: false,
                memberName: model.memberName,
                eventTitle: model.eventTitle,
                emptyTitle: "checkin.history.emptyTitle",
                emptyBody: "checkin.history.emptyBody"
            )
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("checkin.loading")
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
                    Text("checkin.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "checkin.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
