import SwiftUI

/// Galerie (Fotos & Videos, PRO). Registry-/Deeplink-Einstieg aus dem „Mehr"-
/// Hub. Lädt das Entitlement und — nur bei PRO — die Einträge; ohne PRO die
/// Upgrade-Karte. Bilder laufen über `MediaImage` (auth-pflichtiges
/// GET /media/{key}). Web-Referenz: /(portal)/galerie.
struct GalleryRootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = GalleryViewModel()
    @State private var lightboxItem: GalleryLightboxItem?

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Drei Spalten ergeben Kacheln von rund 115 pt — bei Accessibility-Schrift
    /// passt darin keine Bildunterschrift mehr (Album und Titel wurden zu
    /// „WETTK…“ / „Kür-Mit-schnitt…“). Dann lieber ZWEI grosse Kacheln: mehr
    /// Bild, lesbare Beschriftung, größere Trefferfläche.
    private var columns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 2 : 3
        return Array(
            repeating: GridItem(.flexible(), spacing: Theme.Spacing.s2),
            count: count
        )
    }

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
        case .moduleNotBooked:
            RSMModuleNotBookedCard(moduleName: "gallery.title")
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

    /// Album-Filter. Bei Standardschrift eine waagerechte Chip-Reihe.
    ///
    /// Ab Accessibility-Groesse steht jeder Chip in EINER eigenen Zeile ueber
    /// die volle Breite. Vorher lagen die Chips in einem horizontalen
    /// ScrollView, und bei AX3 war der zweite Chip nur noch als „Wettkäm"
    /// am rechten Bildrand zu sehen — technisch erreichbar (man kann ja
    /// scrollen), praktisch aber unsichtbar: nichts deutet an, dass da noch
    /// Filter kommen. Ein Fliess-Layout (`FlowRow`) reicht hier NICHT, weil
    /// ein einzelner Chip bei AX-Schrift breiter werden kann als die Zeile;
    /// er wuerde dann wieder rauslaufen. Volle Breite kann das nicht.
    @ViewBuilder
    private var albumChips: some View {
        let chips = ForEach(viewModel.albumOptions, id: \.self) { option in
            GalleryFilterChip(
                label: label(for: option),
                count: viewModel.count(for: option),
                isActive: viewModel.selectedAlbum == option,
                fillsWidth: dynamicTypeSize.isAccessibilitySize
            ) {
                viewModel.selectedAlbum = option
            }
        }

        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) { chips }
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.s2) { chips }
                    .padding(.horizontal, 2)
            }
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
    /// Volle Zeilenbreite statt Inhaltsbreite (gestapelte AX-Darstellung).
    var fillsWidth: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                label
                    // Der Albumname darf umbrechen, sobald der Chip die volle
                    // Zeile hat — gekuerzte Albumnamen waeren ein Filter, den
                    // man nicht mehr lesen kann.
                    .lineLimit(fillsWidth ? 2 : 1)
                Text(verbatim: "\(count)")
                    .monospacedDigit()
                    .opacity(0.7)
                    // Die Trefferzahl gehoert zum Chip und bleibt ganz.
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                if fillsWidth { Spacer(minLength: 0) }
            }
            .font(Theme.Fonts.caption.weight(.bold))
            .foregroundStyle(isActive ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .frame(maxWidth: fillsWidth ? .infinity : nil, alignment: .leading)
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
