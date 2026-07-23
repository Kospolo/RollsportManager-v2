import SwiftUI

/// Betreiber-Sicht „Küren-Moderation": Küren aller Vereine.
/// Web-Referenz: apps/web/app/(super)/kueren-moderation.
///
/// ### WARUM DAS NICHT DIE VEREINS-KÜREN SIND ###
/// Der Vereins-Bereich zeigt EINEN Verein und kann abspielen. Diese Sicht zeigt
/// ALLE und spielt bewusst NICHTS ab: Moderation heißt hier prüfen, ob eine
/// Datei plausibel ist (hängt Musik dran? wie groß? welcher Typ?) — nicht
/// fremde Wettkampfmusik auf dem Betreiber-Telefon abspielen.
///
/// Der Filter läuft SERVERSEITIG (`club_id`, `status`, `q`, `limit`): die Liste
/// kann über alle Vereine hinweg beliebig lang werden, ein Client-Filter würde
/// erst alles laden und dann wegwerfen.
struct PlatformRoutinesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PlatformSectionModel<[PlatformRoutineRow]>()

    /// `nil` = alle Status.
    @State private var status: PlatformRoutineRowStatus?

    var body: some View {
        PlatformSectionScreen(
            title: "platform.routines.title",
            model: model,
            fetch: fetch,
            isEmpty: { $0.isEmpty },
            emptyImage: "music.note.list",
            emptyTitle: "platform.routines.empty.title",
            emptyMessage: "platform.routines.empty.message"
        ) { rows in
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                filterBar
                Text("platform.routines.count \(rows.count)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .padding(.leading, Theme.Spacing.s1)
                ForEach(rows, id: \.id) { row in
                    routineCard(row)
                }
            }
        }
    }

    private func fetch() async throws -> [PlatformRoutineRow] {
        try await session.api.listPlatformRoutines(status: status, limit: 200)
    }

    // MARK: - Filter

    /// Menü statt Chip-Reihe: fünf Status nebeneinander sind bei grosser
    /// Schrift nicht mehr lesbar, und ein Menü trägt seine Auswahl im Titel.
    private var filterBar: some View {
        Menu {
            Button { select(nil) } label: { filterLabel(nil) }
            ForEach(PlatformRoutineRowStatus.allCases, id: \.rawValue) { option in
                Button { select(option) } label: { filterLabel(option) }
            }
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .accessibilityHidden(true)
                Text(Self.statusKey(status))
                    .font(Theme.Fonts.bodyStrong)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .accessibilityHidden(true)
            }
            .foregroundStyle(Theme.Colors.brandInk)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.brandSoft)
            .clipShape(Capsule())
        }
        .accessibilityLabel(Text("platform.routines.filter.a11y"))
    }

    @ViewBuilder
    private func filterLabel(_ option: PlatformRoutineRowStatus?) -> some View {
        if option == status {
            Label(Self.statusKey(option), systemImage: "checkmark")
        } else {
            Text(Self.statusKey(option))
        }
    }

    private func select(_ option: PlatformRoutineRowStatus?) {
        guard option != status else { return }
        status = option
        _Concurrency.Task { await model.load(fetch) }
    }

    // MARK: - Karte

    private func routineCard(_ row: PlatformRoutineRow) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(verbatim: row.title)
                            .font(Theme.Fonts.listTitle)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(verbatim: row.clubName)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                    Spacer(minLength: Theme.Spacing.s2)
                    RSMStatusPill(
                        text: Self.statusKey(row.status),
                        kind: Self.statusKind(row.status)
                    )
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    PlatformDetailRow(
                        label: "platform.routines.category",
                        value: PlatformFormat.text(row.category)
                    )
                    PlatformDetailRow(
                        label: "platform.routines.music",
                        value: musicText(row)
                    )
                    PlatformDetailRow(
                        label: "platform.routines.duration",
                        value: durationText(row.musicDurationMs),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.routines.file",
                        value: fileText(row),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.routines.skaters",
                        value: PlatformFormat.count(row.skaterCount),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.routines.updatedAt",
                        value: PlatformFormat.dateTime(row.updatedAt)
                    )
                }
            }
        }
    }

    private func musicText(_ row: PlatformRoutineRow) -> Text {
        switch (row.musicTitle, row.musicArtist) {
        case let (title?, artist?): return Text(verbatim: "\(title) — \(artist)")
        case let (title?, nil): return Text(verbatim: title)
        case let (nil, artist?): return Text(verbatim: artist)
        default: return Text("platform.routines.noMusic")
        }
    }

    /// mm:ss aus Millisekunden — bei Küren die einzige Länge, die zählt.
    private func durationText(_ ms: Int?) -> Text {
        guard let ms, ms > 0 else { return Text(verbatim: "–") }
        let total = ms / 1000
        return Text(verbatim: String(format: "%d:%02d", total / 60, total % 60))
    }

    /// „Datei da?" ist die eigentliche Moderationsfrage. Ohne Audio-Asset ist
    /// eine Kür im Status „wettkampfbereit" ein Problem — das sagt die Zeile.
    private func fileText(_ row: PlatformRoutineRow) -> Text {
        guard row.audioAssetId != nil else { return Text("platform.routines.noFile") }
        guard let bytes = row.audioSizeBytes else { return Text("platform.routines.fileOk") }
        let size = ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
        return Text(verbatim: size)
    }

    // MARK: - Beschriftungen

    static func statusKey(_ status: PlatformRoutineRowStatus?) -> LocalizedStringKey {
        switch status {
        case .draft: "platform.routines.status.draft"
        case .ready: "platform.routines.status.ready"
        case .competition: "platform.routines.status.competition"
        case .archived: "platform.routines.status.archived"
        case nil: "platform.routines.status.all"
        }
    }

    static func statusKind(_ status: PlatformRoutineRowStatus) -> RSMStatusKind {
        switch status {
        case .draft: .neutral
        case .ready: .info
        // Honig ist EXKLUSIV für Musik/Küren — hier also genau richtig.
        case .competition: .honey
        case .archived: .neutral
        }
    }
}
