import SwiftUI

/// „Mehr“-Hub: Karten-Raster ALLER Vereins-Bereiche (Web-Referenz:
/// apps/web/app/(portal)/mehr). Zwei Abschnitte:
///
/// - „Verfügbar“: die vier neuen Module (News/Chat/Medaillen/Trainingsplan,
///   mit „Neu“-Badge) und die bereits nativen Bereiche (Übersicht, Termine,
///   Mitglieder, Küren, Finanzen) — alle als NavigationLink im
///   NavigationStack des Mehr-Tabs.
/// - „Bald verfügbar“: die restlichen Bereiche als getönte Icon-Kacheln
///   ohne Navigation (Badge „Bald“).
///
/// Erwartet `SessionStore` im Environment (liefert die Tab-Shell) und einen
/// umgebenden NavigationStack.
struct MehrHubView: View {
    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                section(header: "mehr.section.available", tiles: MehrCatalog.available)
                section(header: "mehr.section.soon", tiles: MehrCatalog.soon)
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("mehr.title"))
        .navigationBarTitleDisplayMode(.large)
    }

    private func section(header: LocalizedStringKey, tiles: [MehrTile]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text(header)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
                .padding(.leading, Theme.Spacing.s1)

            LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                ForEach(tiles) { tile in
                    tileView(tile)
                }
            }
        }
    }

    @ViewBuilder
    private func tileView(_ tile: MehrTile) -> some View {
        if let destination = tile.destination {
            NavigationLink {
                destination
            } label: {
                MehrTileCard(tile: tile)
            }
            .buttonStyle(RSMPressableButtonStyle())
        } else {
            MehrTileCard(tile: tile)
                .accessibilityElement(children: .combine)
                .accessibilityHint(Text("mehr.section.soon"))
        }
    }
}

/// Eine Kachel im Heimspiel-Look: getöntes Icon-Quadrat, Titel, Unterzeile,
/// dazu ein „Neu“- bzw. „Bald“-Badge. „Bald“-Kacheln sind dezent (gestrichelt,
/// leicht transparent) und tragen keinen Chevron.
struct MehrTileCard: View {
    let tile: MehrTile

    private var isSoon: Bool { !tile.isNavigable }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(alignment: .top) {
                iconTile
                Spacer(minLength: 0)
                badge
            }
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(tile.titleKey)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(isSoon ? Theme.Colors.inkSoft : Theme.Colors.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Text(tile.descKey)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(border)
        .opacity(isSoon ? 0.7 : 1)
        .shadow(
            color: isSoon ? .clear : Theme.Shadows.card.color,
            radius: isSoon ? 0 : Theme.Shadows.card.radius,
            x: 0, y: isSoon ? 0 : Theme.Shadows.card.y
        )
    }

    private var iconTile: some View {
        Image(systemName: tile.systemImage)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(tile.tone.foreground)
            .frame(width: 40, height: 40)
            .background(tile.tone.background)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var badge: some View {
        if isSoon {
            MehrBadge(text: "mehr.badge.soon", tone: .neutral)
        } else if tile.isNew {
            MehrBadge(text: "mehr.badge.new", tone: .brand)
        } else {
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder
    private var border: some View {
        let shape = RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
        if isSoon {
            shape.strokeBorder(
                Theme.Colors.line,
                style: StrokeStyle(lineWidth: 1, dash: [4, 4])
            )
        } else {
            shape.strokeBorder(Theme.Colors.line, lineWidth: 1)
        }
    }
}

/// Kleines Pill-Badge („Neu“ / „Bald“) im Kachelkopf.
private struct MehrBadge: View {
    let text: LocalizedStringKey
    let tone: MehrTone

    var body: some View {
        Text(text)
            .font(Theme.Fonts.eyebrow)
            .tracking(Theme.Fonts.eyebrowTracking)
            .textCase(.uppercase)
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, Theme.Spacing.s2)
            .padding(.vertical, 3)
            .background(tone.background)
            .clipShape(Capsule())
    }
}
