import SwiftUI

/// Kür-Detail: Kopf (Mensch zuerst) + Trainings-Player + Zeitmarken +
/// RollArt-Verlauf + lokale Notizen. Kür und Läufer:innen kommen aus der
/// Liste mit; Marker/Wertungen lädt das ViewModel (Loading/Error/Retry).
struct RoutineDetailView: View {
    let item: RoutineListItem

    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = RoutineDetailViewModel()
    @StateObject private var playback: RoutinePlaybackEngine

    init(item: RoutineListItem) {
        self.item = item
        _playback = StateObject(
            wrappedValue: RoutinePlaybackEngine(durationMs: Double(item.routine.musicDurationMs ?? 0))
        )
    }

    private var routine: Routine { item.routine }

    private var hasPlayableMusic: Bool {
        playback.durationMs > 0 && !(routine.waveformPeaks ?? []).isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                header
                metaLines

                if hasPlayableMusic {
                    RoutinePlayerCard(routine: routine, playback: playback)
                } else {
                    RSMCard {
                        RSMEmptyState(
                            systemImage: "music.note",
                            title: "routines.detail.noMusic.title",
                            message: "routines.detail.noMusic.message"
                        )
                    }
                }

                detailSections
                RoutineNotesView(routineId: routine.id)
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(verbatim: routine.title))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadIfNeeded(
                api: session.api,
                routineId: routine.id,
                clubId: session.clubId
            )
        }
        .onDisappear { playback.stop() }
    }

    // MARK: - Kopf: Mensch zuerst, dann Kür

    private var header: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            HStack(spacing: -Theme.Spacing.s2) {
                ForEach(item.skaters, id: \.id) { member in
                    RSMAvatarView(
                        name: "\(member.firstName) \(member.lastName)",
                        personId: member.id,
                        size: 44
                    )
                    .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2))
                }
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(verbatim: routine.title)
                    .font(Theme.Fonts.h2)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                HStack(spacing: Theme.Spacing.s2) {
                    RSMStatusPill(text: routine.status.labelKey, kind: routine.status.pillKind)
                    categoryLine
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var categoryLine: some View {
        HStack(spacing: Theme.Spacing.s1) {
            if let category = routine.category {
                Text(verbatim: category)
                Text(verbatim: "·")
            }
            Text(routineDisciplineKey(skaterCount: routine.skaterMemberIds.count))
        }
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.inkSoft)
        .lineLimit(1)
    }

    // MARK: - Meta: Musik · Länge/BPM · Läufer:innen

    private var metaLines: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            if let musicTitle = routine.musicTitle {
                metaLine(systemName: "music.note", tint: Theme.Colors.honeyDeep) {
                    Text(verbatim: [musicTitle, routine.musicArtist].compactMap { $0 }.joined(separator: " · "))
                }
            }
            if let durationMs = routine.musicDurationMs {
                metaLine(systemName: "clock", tint: Theme.Colors.inkFaint) {
                    HStack(spacing: Theme.Spacing.s1) {
                        Text("routines.detail.meta.length \(RoutineFormat.mmss(Double(durationMs)))")
                        if let bpm = routine.musicBpm {
                            Text(verbatim: "·")
                            Text("routines.detail.meta.bpm \(bpm)")
                        }
                    }
                    .monospacedDigit()
                }
            }
            if !item.skaters.isEmpty {
                metaLine(systemName: "person.2", tint: Theme.Colors.inkFaint) {
                    Text(verbatim: item.skaterNames)
                }
            }
        }
    }

    private func metaLine(
        systemName: String,
        tint: Color,
        @ViewBuilder content: () -> some View
    ) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: systemName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 16)
                .accessibilityHidden(true)
            content()
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
        }
    }

    // MARK: - Marker + Verlauf (abhängig vom ViewModel-Zustand)

    @ViewBuilder private var detailSections: some View {
        switch viewModel.state {
        case .loading:
            RSMCard {
                ProgressView()
                    .tint(Theme.Colors.brand)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.s6)
            }
        case .error(let message):
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.Colors.danger)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("routines.detail.error.title")
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.danger)
                            Text(verbatim: message)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    RSMSecondaryButton(title: "routines.common.retry") {
                        _Concurrency.Task {
                            await viewModel.load(
                                api: session.api,
                                routineId: routine.id,
                                clubId: session.clubId
                            )
                        }
                    }
                }
            }
        case .loaded(let details):
            RoutineMarkerListView(
                markers: details.markers,
                loopOn: playback.loopOn,
                loopAMs: playback.loopAMs,
                loopBMs: playback.loopBMs,
                onJump: { playback.playFrom($0) }
            )
            RoutineScoreTrendView(
                scores: details.scores,
                competitionNames: details.competitionNames
            )
        }
    }
}
