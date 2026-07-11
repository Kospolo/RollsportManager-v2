import SwiftUI

/// Auswahl der zu wertenden Kür fürs ScorePad-Sheet — bewusst ein eigener,
/// `Identifiable`-Wrapper statt einer Konformanz auf dem Contracts-Typ
/// (Kollisionen zwischen den parallelen Feature-Teams vermeiden).
struct CompetitionScoreTarget: Identifiable {
    let row: CompetitionStandingRow
    var id: String { row.entryId }
}

/// Detail eines Wettkampfs: Kopf (Datum · Ort · Stand) und darunter je Kategorie
/// die Startliste als Live-Rangliste (`getCompetitionStandings`) mit Rang,
/// RollArt-Wertung und Delta zur Vorwertung. Der Trainerstab kann jede Kür
/// antippen und die RollArt-Wertung erfassen (`saveRoutineScore`); Mitglieder
/// sehen die Rangliste lesend. Läuft im NavigationStack des „Mehr“-Tabs.
/// Web-Referenz: wettkampf/_components/{LiveTab,LiveStandings}.
struct CompetitionDetailView: View {
    let competition: Competition

    @EnvironmentObject private var session: SessionStore
    @StateObject private var model: CompetitionDetailViewModel
    @State private var scoring: CompetitionScoreTarget?

    init(competition: Competition, clubRole: ClubRole?) {
        self.competition = competition
        _model = StateObject(wrappedValue: CompetitionDetailViewModel(
            competitionId: competition.id,
            clubRole: clubRole
        ))
    }

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
        .navigationTitle(Text(verbatim: competition.name))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await model.loadIfNeeded(api: session.api)
#if DEBUG
            applyDetailDevHooks()
#endif
        }
        .sheet(item: $scoring) { target in
            CompetitionScorePadSheet(
                api: session.api,
                competitionId: competition.id,
                row: target.row,
                onSaved: { _ in
                    _Concurrency.Task { await model.refresh() }
                }
            )
        }
        .alert("wettkampf.error.title", isPresented: refreshErrorBinding) {
            Button("wettkampf.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: `-devOpenScorePad YES` öffnet nach dem Laden das
    /// ScorePad für die erste Kür (nur Trainerstab). Ohne das Flag nichts.
    private func applyDetailDevHooks() {
        guard UserDefaults.standard.bool(forKey: "devOpenScorePad"),
              model.canScore,
              let first = model.rows.first
        else { return }
        // Kurzer Aufschub: falls das Detail per Auto-Nav (`-devOpenCompetition
        // Detail`) frisch gepusht wurde, würde ein sofortiges Sheet mit der
        // Push-Transition kollidieren und still verworfen. Nach dem Settle klappt's.
        _Concurrency.Task {
            try? await _Concurrency.Task.sleep(nanoseconds: 700_000_000)
            scoring = CompetitionScoreTarget(row: first)
        }
    }
#endif

    // MARK: - Inhalt

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                summaryCard
                introHint
                if model.rows.isEmpty {
                    emptyState
                } else {
                    ForEach(model.groups) { group in
                        categorySection(group)
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    private var summaryCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                    Text(verbatim: WettkampfDate.absolute(competition.startsAt))
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Spacer(minLength: 0)
                    RSMStatusPill(
                        text: WettkampfStatusDisplay.labelKey(competition.status),
                        kind: WettkampfStatusDisplay.pillKind(competition.status)
                    )
                }
                HStack(spacing: Theme.Spacing.s4) {
                    if let location = competition.location, !location.isEmpty {
                        summaryMeta(icon: "mappin.and.ellipse", text: location)
                    }
                    summaryMeta(icon: "clock", text: timeRange)
                    Spacer(minLength: 0)
                }
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)

                Text(standingsStateKey)
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
    }

    private func summaryMeta(icon: String, text: String) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .monospacedDigit()
                .lineLimit(1)
        }
    }

    /// Kurzer Hinweis (Trainer erfasst / Mitglied liest) — spiegelt die
    /// Web-Intros `liveTrainerIntro`/`liveMemberIntro`.
    private var introHint: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: model.canScore ? "sparkles" : "eye")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.brand)
                .accessibilityHidden(true)
            Text(model.canScore ? "wettkampf.intro.trainer" : "wettkampf.intro.member")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.brandSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }

    private func categorySection(_ group: WettkampfStandingsGroup) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: group.category.isEmpty
                    ? String(localized: "wettkampf.category.fallback")
                    : group.category)
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
                Spacer(minLength: Theme.Spacing.s2)
                Text("wettkampf.category.count \(group.rows.count)")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            .padding(.horizontal, Theme.Spacing.s1)

            RSMCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(group.rows, id: \.entryId) { row in
                        CompetitionStandingRowView(
                            row: row,
                            canScore: model.canScore,
                            onScore: model.canScore
                                ? { scoring = CompetitionScoreTarget(row: row) }
                                : nil
                        )
                        if row.entryId != group.rows.last?.entryId {
                            Divider().overlay(Theme.Colors.line)
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "figure.skating",
                title: "wettkampf.detail.empty.title",
                message: "wettkampf.detail.empty.message"
            )
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("wettkampf.loading")
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
                    Text("wettkampf.standings.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "wettkampf.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Ableitungen

    /// Startliste (noch keine Wertung) → Zwischenstand → Endstand.
    private var standingsStateKey: LocalizedStringKey {
        if !model.hasAnyScore { return "wettkampf.detail.state.startlist" }
        if model.isFinal { return "wettkampf.detail.state.final" }
        return "wettkampf.detail.state.progress"
    }

    private var timeRange: String {
        "\(WettkampfDate.time(competition.startsAt))–\(WettkampfDate.time(competition.endsAt))"
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
