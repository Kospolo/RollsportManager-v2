import SwiftUI

/// „Mehr“-Hub: Karten-Raster der Vereins-Bereiche, die DIESE Person sehen soll
/// (Web-Referenz: apps/web/app/(portal)/mehr). Zwei Abschnitte:
///
/// - „Verfügbar“: die Bereiche, die der Server für diese Person meldet — als
///   NavigationLink im NavigationStack des Mehr-Tabs.
/// - „Bald verfügbar“: noch nicht gebaute Bereiche als getönte Icon-Kacheln
///   ohne Navigation (Badge „Bald“). Fällt ein Abschnitt ganz weg, fällt auch
///   seine Überschrift weg — leere Rubriken gibt es hier nicht.
///
/// ### WELCHE KACHELN ERSCHEINEN ###
/// Die Liste kommt aus `GET /clubs/{clubId}/modules/effective` (Migration 0077)
/// und wird hier NICHT nachgerechnet. Vorher filterte dieser Hub genau zwei von
/// 31 Kacheln (Betreiber + Verwaltung) — ein Kind sah dieselben ~29 Module wie
/// der Vorstand. Jetzt entscheidet der Server einmal für alle vier Clients.
///
/// ### DAS AUSBLENDEN IST BEQUEMLICHKEIT, KEIN SCHUTZ ###
/// Wer eine Kachel nicht sieht, darf über einen Deeplink genau so viel wie
/// vorher; wer eine sieht, bekommt dadurch kein Recht. Die Daten schützen RLS,
/// Entitlement, Modul-Gates und Fähigkeiten — alle serverseitig. Ausführlich im
/// Kopf von `MehrVisibility.swift`.
///
/// Erwartet `SessionStore` im Environment (liefert die Tab-Shell) und einen
/// umgebenden NavigationStack.
struct MehrHubView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var visibility = MehrVisibilityStore()

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
    ]

    /// „Verfügbar“-Raster: die Verwaltungs-Kachel steht (rollen-gated) ganz oben,
    /// danach der statische Katalog — und über allem der Modul-Filter des
    /// Servers.
    ///
    /// Die beiden lokalen Gates bleiben zusätzlich stehen, sie sind NICHT
    /// redundant: `isPlatformAdmin` hängt an einem Token-Claim statt an einem
    /// Vereinsmodul, und die Verwaltung ist ein Kernmodul, das serverseitig
    /// niemand ausblenden kann (0077 lehnt das mit 409 ab). Beides mit UND
    /// verknüpft — nie mit ODER.
    private var availableTiles: [MehrTile] {
        var tiles: [MehrTile] = []
        // Betreiber ganz oben (Token-Claim, keine Vereinsrolle), danach die
        // Verwaltung (Vereinsleitung), dann der normale Katalog.
        if session.permissions.isPlatformAdmin { tiles.append(MehrCatalog.platform) }
        if session.permissions.isClubAdmin { tiles.append(MehrCatalog.verwaltung) }
        return (tiles + MehrCatalog.available).filter { visibility.isVisible(tileId: $0.id) }
    }

    /// Beim Personen- oder Vereinswechsel neu fragen. Die Sichtbarkeit ist an
    /// die Rolle gebunden — eine Liste aus der vorigen Session wäre falsch.
    private var reloadKey: String {
        "\(session.clubId)|\(session.session?.persona ?? "-")"
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    if let message = visibility.fallbackMessage {
                        MehrFallbackBanner(detail: message) { await reload() }
                    }
                    if visibility.isLoading {
                        skeletonSection
                    } else {
                        if !availableTiles.isEmpty {
                            section(header: "mehr.section.available", tiles: availableTiles)
                        }
                        if !MehrCatalog.soon.isEmpty {
                            section(header: "mehr.section.soon", tiles: MehrCatalog.soon)
                        }
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("mehr.title"))
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await reload() }
            .task(id: reloadKey) { await reload() }
#if DEBUG
            // NUR DEBUG/Smoke-Test: `-devMehrScrollTo <id>` scrollt eine Kachel
            // in den sichtbaren Bereich (additive Deeplink-Automation).
            .task {
                if let id = UserDefaults.standard.string(forKey: "devMehrScrollTo") {
                    try? await _Concurrency.Task.sleep(nanoseconds: 400_000_000)
                    withAnimation { proxy.scrollTo(id, anchor: .center) }
                }
            }
#endif
        }
    }

    private func reload() async {
        await visibility.load(
            api: session.api,
            clubId: session.clubId,
            hasClubMembership: session.hasClubMembership
        )
#if DEBUG
        // NUR DEBUG/Smoke-Test: `-devMehrCountTiles YES` schreibt die wirklich
        // gezeigten Kacheln in die Konsole. Der Beweis „wie viele sieht diese
        // Rolle?“ wird damit GEZÄHLT statt vom Screenshot abgeschätzt
        // (Geschwister-Hook zu `-devMehrScrollTo`).
        if UserDefaults.standard.bool(forKey: "devMehrCountTiles") {
            let ids = availableTiles.map(\.id)
            print("[MehrHub] Kacheln: \(ids.count) — \(ids.joined(separator: ", "))")
        }
#endif
    }

    /// Ladezustand: Platzhalter im Format der echten Kacheln. Bewusst NICHT die
    /// echten Kacheln — alle 31 aufblitzen zu lassen und dann die Hälfte
    /// wegzunehmen war genau der Befund.
    private var skeletonSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            sectionHeader("mehr.section.available")
            LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                ForEach(0..<6, id: \.self) { _ in MehrTileSkeleton() }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("mehr.visibility.loading"))
    }

    private func sectionHeader(_ key: LocalizedStringKey) -> some View {
        Text(key)
            .font(Theme.Fonts.eyebrow)
            .tracking(Theme.Fonts.eyebrowTracking)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Colors.inkFaint)
            .padding(.leading, Theme.Spacing.s1)
    }

    private func section(header: LocalizedStringKey, tiles: [MehrTile]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            sectionHeader(header)

            LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                ForEach(tiles) { tile in
                    tileView(tile)
                        .id(tile.id)
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

/// Platzhalter-Kachel für den Ladezustand — dieselbe Geometrie wie
/// `MehrTileCard`, nur ohne Inhalt. Kein Blinken, keine Animation: das Raster
/// steht danach an derselben Stelle, statt zu springen.
private struct MehrTileSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                .fill(Theme.Colors.bgSunken)
                .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous)
                    .fill(Theme.Colors.bgSunken)
                    .frame(height: 12)
                    .frame(maxWidth: 96, alignment: .leading)
                RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous)
                    .fill(Theme.Colors.bgSunken)
                    .frame(height: 10)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .strokeBorder(Theme.Colors.line, lineWidth: 1)
        )
        .accessibilityHidden(true)
    }
}

/// Rückfall-Banner: der Server konnte nicht sagen, welche Bereiche gelten.
///
/// Es sagt ehrlich, was gerade fehlt, statt einfach alles zu zeigen — und es
/// sagt ausdrücklich dazu, dass sich an den RECHTEN nichts ändert: die liegen
/// auf dem Server, nicht in diesem Menü.
private struct MehrFallbackBanner: View {
    let detail: String
    let retry: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Colors.warn)
                    .accessibilityHidden(true)
                Text("mehr.visibility.error.title")
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            Text("mehr.visibility.error.body")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
            Text(detail)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                _Concurrency.Task { await retry() }
            } label: {
                Text("mehr.visibility.error.retry")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.brandInk)
                    .padding(.horizontal, Theme.Spacing.s4)
                    .frame(minHeight: Theme.Size.touchTarget)
                    .background(Theme.Colors.brandSoft)
                    .clipShape(Capsule())
            }
            .buttonStyle(RSMPressableButtonStyle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.warnSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
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
                    .lineLimit(2)
                Text(tile.descKey)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
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
        } else if tile.isNew || tile.isPro {
            HStack(spacing: Theme.Spacing.s1) {
                if tile.isPro {
                    MehrBadge(text: "mehr.badge.pro", tone: .honey)
                }
                if tile.isNew {
                    MehrBadge(text: "mehr.badge.new", tone: .brand)
                }
            }
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
