import SwiftUI

/// Galerie (Fotos & Videos, PRO). Registry-/Deeplink-Einstieg aus dem „Mehr"-
/// Hub. Lädt das Entitlement und — nur bei PRO — die Einträge; ohne PRO die
/// Upgrade-Karte. Bilder laufen über `MediaImage` (auth-pflichtiges
/// GET /media/{key}). Web-Referenz: /(portal)/galerie.
struct GalleryRootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = GalleryViewModel()
    @State private var lightboxItem: GalleryLightboxItem?

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s2),
        GridItem(.flexible(), spacing: Theme.Spacing.s2),
        GridItem(.flexible(), spacing: Theme.Spacing.s2),
    ]

    var body: some View {
        ScrollView {
            content
                .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("gallery.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .sheet(item: $lightboxItem) { wrapper in
            GalleryLightbox(item: wrapper.item)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ProgressView()
                .tint(Theme.Colors.brand)
                .frame(maxWidth: .infinity)
                .padding(.top, Theme.Spacing.s9)
        case .proRequired:
            RSMProGateCard(
                title: "gallery.pro.title",
                message: "gallery.pro.message",
                systemImage: "photo.on.rectangle.angled"
            )
        case .error(let message):
            errorCard(message)
        case .loaded(let items):
            if items.isEmpty {
                RSMEmptyState(
                    systemImage: "photo.on.rectangle.angled",
                    title: "gallery.empty.title",
                    message: "gallery.empty.message"
                )
                .padding(.top, Theme.Spacing.s7)
            } else {
                loadedGrid
            }
        }
    }

    private var loadedGrid: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            if viewModel.showFilter {
                albumChips
            }
            LazyVGrid(columns: columns, spacing: Theme.Spacing.s2) {
                ForEach(viewModel.visibleItems, id: \.id) { item in
                    Button {
                        lightboxItem = GalleryLightboxItem(item: item)
                    } label: {
                        GalleryThumbnail(item: item)
                    }
                    .buttonStyle(RSMPressableButtonStyle())
                    .accessibilityLabel(Text(verbatim: item.title))
                }
            }
        }
    }

    private var albumChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(viewModel.albumOptions, id: \.self) { option in
                    GalleryFilterChip(
                        label: label(for: option),
                        count: viewModel.count(for: option),
                        isActive: viewModel.selectedAlbum == option
                    ) {
                        viewModel.selectedAlbum = option
                    }
                }
            }
            .padding(.horizontal, 2)
        }
    }

    /// Chip-Beschriftung: „Alle"/„Ohne Album" lokalisiert, Album-Name verbatim.
    private func label(for option: GalleryAlbumFilter) -> Text {
        switch option {
        case .all: return Text("gallery.allAlbums")
        case .unfiled: return Text("gallery.noAlbum")
        case .album(let name): return Text(verbatim: name)
        }
    }

    private func errorCard(_ message: String) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("gallery.error.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.danger)
                Text(verbatim: message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                RSMSecondaryButton(title: "routines.common.retry") {
                    _Concurrency.Task { await viewModel.load(api: session.api, clubId: session.clubId) }
                }
            }
        }
    }
}

/// Filter-Chip mit Zähler: aktiv = Beere-Fläche, sonst gedämpfte Mulde.
private struct GalleryFilterChip: View {
    let label: Text
    let count: Int
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                label
                Text(verbatim: "\(count)")
                    .monospacedDigit()
                    .opacity(0.7)
            }
            .font(Theme.Fonts.caption.weight(.bold))
            .foregroundStyle(isActive ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .background(isActive ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
    }
}

/// Identifizierbarer Wrapper für `.sheet(item:)` — der generierte `GalleryItem`
/// (READ-ONLY Contract) ist bewusst nicht `Identifiable`.
struct GalleryLightboxItem: Identifiable {
    let item: GalleryItem
    var id: String { item.id }
}

/// Öffentlicher Feature-Einstieg (Deliverable-Name). Verweist auf die
/// registry-/deeplink-verdrahtete `GalleryRootView`.
typealias GalleryView = GalleryRootView
