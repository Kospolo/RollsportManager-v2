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
        ScrollViewReader { proxy in
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                header
                metaLines

                if hasPlayableMusic {
                    RoutinePlayerCard(routine: routine, playback: playback)
                    addMarkerButton
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
                    .id("routine-markers")
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
#if DEBUG
            // NUR DEBUG/Smoke-Test: `-devAutoAddMarker YES` setzt eine
            // Zeitmarke über denselben echten Pfad wie der Button
            // (POST /routines/{id}/markers) an einer festen Demo-Position.
            if UserDefaults.standard.bool(forKey: "devAutoAddMarker") {
                await viewModel.addMarker(
                    api: session.api,
                    routineId: routine.id,
                    atMs: 53400
                )
                // Zeitmarken-Liste in den sichtbaren Bereich holen, damit ein
                // Smoke-Screenshot den neuen Marker zeigt (nur DEBUG).
                try? await _Concurrency.Task.sleep(nanoseconds: 300_000_000)
                withAnimation { proxy.scrollTo("routine-markers", anchor: .top) }
            }
#endif
        }
        .onDisappear { playback.stop() }
        .alert("routines.detail.error.title", isPresented: markerErrorBinding) {
            Button("routines.common.ok", role: .cancel) {}
        } message: {
            Text(verbatim: viewModel.markerError ?? "")
        }
        }
    }

    // MARK: - Markierung an aktueller Position setzen

    /// „Markierung hinzufügen“ an der Playhead-Position (`playback.posMs`).
    /// Nur sichtbar, wenn die Marker-Liste geladen ist (dort landet der neue
    /// Marker optimistisch). Während des POST: disabled + Spinner.
    @ViewBuilder private var addMarkerButton: some View {
        if case .loaded = viewModel.state {
            Button {
                _Concurrency.Task {
                    await viewModel.addMarker(
                        api: session.api,
                        routineId: routine.id,
                        atMs: playback.posMs
                    )
                }
            } label: {
                HStack(spacing: Theme.Spacing.s2) {
                    if viewModel.isAddingMarker {
                        ProgressView().tint(Theme.Colors.honeyDeep)
                    } else {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.system(size: 13, weight: .bold))
                    }
                    Text("marker.add \(RoutineFormat.mmss(playback.posMs))")
                        .font(Theme.Fonts.body(size: 13, weight: .heavy))
                        .monospacedDigit()
                }
                .foregroundStyle(Theme.Colors.honeyDeep)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .background(Capsule().fill(Theme.Colors.honeySoft))
                .overlay(Capsule().stroke(Theme.Colors.honeyDeep.opacity(0.3), lineWidth: 1))
            }
            .buttonStyle(RSMPressableButtonStyle())
            .disabled(viewModel.isAddingMarker)
            .accessibilityLabel(Text("marker.a11y.add"))
        }
    }

    private var markerErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.markerError != nil },
            set: { if !$0 { viewModel.markerError = nil } }
        )
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
