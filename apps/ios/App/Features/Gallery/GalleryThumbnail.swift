import SwiftUI

/// Quadratische Galerie-Kachel (Web-Referenz: GalleryCard): auth-getragenes
/// Vorschaubild über `MediaImage` (Thumbnail-Key, sonst Original), unten ein
/// Verlauf mit Album-Eyebrow + Titel, Videos mit Play-Overlay & Badge.
struct GalleryThumbnail: View {
    let item: GalleryItem

    private var isVideo: Bool { item.kind == .video }
    private var album: String? { GalleryViewModel.normalizedAlbum(item) }

    var body: some View {
        MediaImage(key: item.thumbnailKey ?? item.storageKey, contentMode: .fill)
            .aspectRatio(1, contentMode: .fill)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .bottomLeading) { caption }
            .overlay { if isVideo { videoOverlay } }
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                    .stroke(Theme.Colors.line, lineWidth: 1)
            )
    }

    // Verlauf + Album/Titel unten (dekorativ, Klick fällt auf die Kachel).
    private var caption: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let album {
                Text(verbatim: album)
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.4)
                    .textCase(.uppercase)
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1)
            }
            Text(verbatim: item.title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .shadow(radius: 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.s2)
        .padding(.top, Theme.Spacing.s6)
        .padding(.bottom, Theme.Spacing.s2)
        .background(
            LinearGradient(
                colors: [.black.opacity(0.72), .black.opacity(0.24), .clear],
                startPoint: .bottom,
                endPoint: .top
            )
        )
        .accessibilityHidden(true)
    }

    // Zentrales Play + kleines „Video"-Badge oben links.
    private var videoOverlay: some View {
        ZStack {
            Image(systemName: "play.fill")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .padding(Theme.Spacing.s3)
                .background(.black.opacity(0.45))
                .clipShape(Circle())
                .overlay(Circle().stroke(.white.opacity(0.4), lineWidth: 1))

            Text("gallery.kind.video")
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(.white)
                .padding(.horizontal, Theme.Spacing.s2)
                .padding(.vertical, 2)
                .background(.black.opacity(0.55))
                .clipShape(Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(Theme.Spacing.s2)
        }
        .accessibilityHidden(true)
    }
}
