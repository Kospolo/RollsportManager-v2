import SwiftUI

/// ÖFFENTLICHE Root-View des Küren-Moduls (Tab „Küren“).
///
/// Integration: in MainTabView als `NavigationStack { RoutinesRootView() }`
/// verdrahten — die Detail-Navigation läuft hier drin über NavigationLink.
/// Erwartet `SessionStore` als EnvironmentObject.
struct RoutinesRootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = RoutinesViewModel()
    /// Vorschau-Wiedergabe der Kacheln — hält höchstens EINE klingende Kür.
    @StateObject private var preview = RoutineListPreviewPlayer()

#if DEBUG
    // Dev-Automation für Smoke-Tests: Launch-Argument `-devOpenFirstRoutine YES`
    // springt nach dem Laden direkt in das Detail der ersten Kür (nur DEBUG).
    @State private var devDetailItem: RoutineListItem?
    @State private var devDetailPresented = false
    @State private var devProbeRan = false
#endif

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded(let items):
                listView(items)
#if DEBUG
                    .onAppear {
                        guard UserDefaults.standard.bool(forKey: "devOpenFirstRoutine"),
                              devDetailItem == nil,
                              let first = items.first else { return }
                        devDetailItem = first
                        devDetailPresented = true
                    }
                    // Beweis-Automation für den Kachel-Knopf (`-devListAudioProbe YES`):
                    // tippt die erste Kür MIT Musik an und protokolliert den
                    // echten Playerzustand. Ohne Flag passiert nichts.
                    .task(id: items.count) {
                        guard UserDefaults.standard.bool(forKey: "devListAudioProbe"),
                              !devProbeRan
                        else { return }
                        let withAudio = items
                            .map(\.routine)
                            .filter { RoutineListPreviewPlayer.hasAudio($0) }
                        guard let first = withAudio.first else { return }
                        devProbeRan = true
                        await preview.devProbe(routine: first, api: session.api)
                        if withAudio.count > 1 {
                            await preview.devProbeExclusive(
                                first: first,
                                second: withAudio[1],
                                api: session.api
                            )
                        }
                    }
#endif
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("routines.list.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
        // Beim Sprung ins Detail (oder aus dem Tab heraus) verstummt die
        // Vorschau — sonst liefen Kachel- und Detail-Player gegeneinander.
        .onDisappear { preview.stop() }
#if DEBUG
        .navigationDestination(isPresented: $devDetailPresented) {
            if let item = devDetailItem {
                RoutineDetailView(item: item)
            }
        }
#endif
    }

    // MARK: - Zustände

    private var loadingView: some View {
        ProgressView()
            .tint(Theme.Colors.brand)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.Colors.danger)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("routines.list.error.title")
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.danger)
                            Text(verbatim: message)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    // Die eine Beere dieses Sichtbereichs: der Weg zurück.
                    RSMPrimaryButton(title: "routines.common.retry") {
                        _Concurrency.Task {
                            await viewModel.load(api: session.api, clubId: session.clubId)
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private func listView(_ items: [RoutineListItem]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                Text("routines.list.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)

                if items.isEmpty {
                    RSMCard {
                        RSMEmptyState(
                            systemImage: "music.note.list",
                            title: "routines.list.empty.title",
                            message: "routines.list.empty.message"
                        )
                    }
                } else {
                    ForEach(items) { item in
                        RoutineListRow(item: item, preview: preview)
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await viewModel.load(api: session.api, clubId: session.clubId) }
    }
}

// MARK: - Zeile: Karte + Play-Affordanz

/// Eine Zeile der Küren-Liste: oben der Karteninhalt (führt ins Detail),
/// unten die Musikleiste mit dem Play-Knopf, der die Kür DIREKT hier abspielt.
///
/// Zwei Entscheidungen, die man sonst nachfragen würde:
///
/// 1. **Kein Knopf im Knopf.** Ein Button im Label eines NavigationLink
///    bekommt die Tipps nicht verlässlich. Navigation und Play sind deshalb
///    GESCHWISTER: der Link umschließt den oberen, zusammenhängenden Block,
///    die Musikleiste steht daneben — nicht darin.
/// 2. **Die Leiste steht UNTEN, nicht rechts.** Ein Knopf in einer eigenen
///    rechten Spalte nimmt jeder Zeile der Karte ~56 pt Breite weg; belegt:
///    „Letzte RollArt-Wertung“ brach dann dreizeilig um und aus dem Chip
///    „+1,30“ wurde eine Blase. Als eigene Zeile kostet der Knopf keine
///    Breite — die bestehenden Zeilen bleiben Pixel für Pixel wie vorher.
///
/// Die ganze Leiste ist die Trefferfläche (Kreis UND Musiktitel), nicht nur
/// der Kreis.
private struct RoutineListRow: View {
    let item: RoutineListItem
    @ObservedObject var preview: RoutineListPreviewPlayer

    @EnvironmentObject private var session: SessionStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Knopfgröße wächst mit der Systemschrift mit (Geometrie, darum
    /// @ScaledMetric statt einer Schriftrolle). Untergrenze: Trefferfläche 44.
    @ScaledMetric(relativeTo: .body) private var playSize: CGFloat = Theme.Size.touchTarget

    private var routine: Routine { item.routine }
    private var playState: RoutineListPreviewPlayer.State { preview.state(for: item.id) }

    private var hasAudio: Bool { RoutineListPreviewPlayer.hasAudio(routine) }

    /// „L'Oiseau de feu (Finale) · Igor Strawinsky“ — nil, wenn keine
    /// Musik-Metadaten hinterlegt sind.
    private var musicLine: String? {
        guard let title = routine.musicTitle, !title.isEmpty else { return nil }
        return [title, routine.musicArtist]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                NavigationLink {
                    RoutineDetailView(item: item)
                } label: {
                    RoutineCardContent(item: item)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(RSMPressableButtonStyle())
                .accessibilityLabel(
                    Text("routines.list.a11y.card \(routine.title) \(item.skaterNames)")
                )

                if musicLine != nil {
                    Divider().overlay(Theme.Colors.line)
                    // KEIN toter Knopf: ohne hinterlegte Datei bleibt die Zeile
                    // eine reine Angabe — die Kür KANN dann nicht klingen.
                    if hasAudio { musicPlayBar } else { musicInfoRow }
                }
            }
        }
    }

    // MARK: - Musikleiste

    /// Spielbare Kür: die ganze Leiste ist der Knopf.
    private var musicPlayBar: some View {
        Button {
            preview.toggle(routine: routine, api: session.api)
        } label: {
            HStack(spacing: Theme.Spacing.s3) {
                playCircle
                Text(verbatim: musicLine ?? "")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(
                        playState == .playing ? Theme.Colors.brand : Theme.Colors.inkSoft
                    )
                    .multilineTextAlignment(.leading)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? 4 : 2)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(playState == .loading || playState == .failed)
        .accessibilityLabel(playA11yLabel)
        .accessibilityAddTraits(playState == .playing ? [] : .startsMediaSession)
        .animation(.snappy(duration: 0.2), value: playState)
    }

    /// Musik hinterlegt, aber keine Datei: Note statt Knopf.
    private var musicInfoRow: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "music.note")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Colors.honeyDeep)
                .accessibilityHidden(true)
            Text(verbatim: musicLine ?? "")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 4 : 2)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    private var playCircle: some View {
        ZStack {
            Circle().fill(
                playState == .failed ? Theme.Colors.bgSunken : Theme.Colors.brand
            )
            playGlyph
        }
        .frame(width: playSize, height: playSize)
        .shadow(
            color: Theme.Shadows.pop.color,
            radius: Theme.Shadows.pop.radius,
            x: Theme.Shadows.pop.x,
            y: Theme.Shadows.pop.y
        )
    }

    @ViewBuilder private var playGlyph: some View {
        switch playState {
        case .loading:
            ProgressView()
                .controlSize(.small)
                .tint(Theme.Colors.brandContrast)
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: playSize * 0.34, weight: .bold))
                .foregroundStyle(Theme.Colors.danger)
        case .idle, .paused, .playing:
            Image(systemName: playState == .playing ? "pause.fill" : "play.fill")
                .font(.system(size: playSize * 0.36, weight: .bold))
                .foregroundStyle(Theme.Colors.brandContrast)
                // Optisches Zentrum: das Play-Dreieck sitzt sonst zu weit links.
                .offset(x: playState == .playing ? 0 : playSize * 0.04)
                .contentTransition(.symbolEffect(.replace))
        }
    }

    /// „Musik abspielen: <Titel>“ — der Titel ist die Musik, nicht die Kür,
    /// solange einer hinterlegt ist.
    private var playA11yLabel: Text {
        let title = routine.musicTitle.flatMap { $0.isEmpty ? nil : $0 } ?? routine.title
        switch playState {
        case .playing: return Text("routines.list.a11y.pauseMusic \(title)")
        case .loading: return Text("routines.list.a11y.loadingMusic \(title)")
        case .failed: return Text("routines.list.a11y.musicUnavailable \(title)")
        case .idle, .paused: return Text("routines.list.a11y.playMusic \(title)")
        }
    }
}

// MARK: - Karteninhalt

/// Kür-Karte der Liste: Läufer:in zuerst (Signatur „Menschen zuerst“),
/// dann Titel, Disziplin, Musik, Dauer und die letzte RollArt-Wertung mit Delta.
/// Ohne eigene `RSMCard` — die Fläche liefert die Zeile, damit der Play-Knopf
/// MIT auf der Karte sitzt statt daneben.
private struct RoutineCardContent: View {
    let item: RoutineListItem

    private var routine: Routine { item.routine }

    /// Ab den Accessibility-Stufen passen Name und Status-Pill nicht mehr
    /// nebeneinander — der Name wuerde abgeschnitten („Maja…“) und die Pill
    /// zur Blase. Dann steht die Pill unter dem Namen.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var statusPill: some View {
        RSMStatusPill(text: routine.status.labelKey, kind: routine.status.pillKind)
    }

    private var skaterLine: some View {
        HStack(spacing: Theme.Spacing.s2) {
            avatarStack
            Text(verbatim: item.skaterNames)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(2)
            Spacer(minLength: Theme.Spacing.s2)
            if !dynamicTypeSize.isAccessibilitySize { statusPill }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            skaterLine
            if dynamicTypeSize.isAccessibilitySize { statusPill }

            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(verbatim: routine.title)
                    .font(Theme.Fonts.listTitle)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                categoryLine
            }

            // Die Musikzeile ist aus dem Karteninhalt herausgewandert: sie ist
            // jetzt die Musikleiste der Zeile (mit Play-Knopf), damit die
            // Wiedergabe direkt auf der Kachel liegt. Siehe RoutineListRow.

            Divider().overlay(Theme.Colors.line)

            bottomRow
        }
    }

    /// Bis zu zwei überlappende Avatare (Paarlauf) — deterministische Töne.
    private var avatarStack: some View {
        HStack(spacing: -Theme.Spacing.s2) {
            ForEach(item.skaters, id: \.id) { member in
                RSMAvatarView(
                    name: "\(member.firstName) \(member.lastName)",
                    personId: member.id,
                    size: 32
                )
                .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2))
            }
        }
        .accessibilityHidden(true)
    }

    /// EIN Text statt einer HStack aus Einzel-Texten: in der HStack brach bei
    /// grosser Schrift nur das erste Stueck um und daneben stand einzeilig
    /// „· Einzellauf“ („Jugend / Kür A  · Einzellauf“). Aneinandergehaengt
    /// umbricht die Zeile wie Fliesstext.
    private var categoryLine: some View {
        let discipline = Text(routineDisciplineKey(skaterCount: routine.skaterMemberIds.count))
        let combined = routine.category.map { Text(verbatim: "\($0) · ") + discipline } ?? discipline
        return combined
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var bottomRow: some View {
        // Dauer links, letzte Wertung rechts — das passt nur bei den
        // Standardstufen nebeneinander. Bei Accessibility-Schrift bricht sonst
        // „Letzte RollArt-Wertung“ Silbe fuer Silbe um.
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s2))
            : AnyLayout(HStackLayout(spacing: Theme.Spacing.s2))
        return layout {
            if let durationMs = routine.musicDurationMs {
                Image(systemName: "clock")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
                Text(verbatim: RoutineFormat.mmss(Double(durationMs)))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            Spacer(minLength: Theme.Spacing.s2)
            if let lastTotal = item.lastTotal {
                Text("routines.list.lastScore")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                Text(verbatim: RoutineFormat.points(lastTotal))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                if let delta = item.delta {
                    RoutineDeltaChip(delta: delta)
                }
            } else {
                Text("routines.list.noScore")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }
}
