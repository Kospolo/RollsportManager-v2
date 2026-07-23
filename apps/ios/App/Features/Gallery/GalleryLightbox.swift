import SwiftUI
import UIKit
import AVKit

/// Vollbild-Vorschau eines Galerie-Eintrags (Web-Referenz: GalleryLightbox).
/// Foto: Originalbild (auth über `MediaImage`, nie beschnitten). Video: nativer
/// `VideoPlayer` — die Bytes kommen auth-getragen über `downloadMedia` in eine
/// temporäre Datei (ein nacktes `AVPlayer(url:)` auf /media/{key} bekäme kein
/// Bearer). Darunter Album + Datum, oben rechts „Teilen".
struct GalleryLightbox: View {
    let item: GalleryItem
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = GalleryLightboxViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.bgCanvas.ignoresSafeArea()
                // ScrollView statt starrer VStack, seit unter dem Bild die
                // Markierungen stehen: sie können mehrere Zeilen lang werden,
                // und bei Accessibility-Schrift passt sonst nichts mehr aufs
                // Blatt. Das Medium bekommt dafür eine feste Höhe — in einem
                // ScrollView würde `maxHeight: .infinity` auf null fallen.
                ScrollView {
                    VStack(spacing: Theme.Spacing.s4) {
                        media
                            .frame(height: 340)
                        metadata
                        PhotoTagSection(item: item)
                    }
                    .padding(Theme.Spacing.s5)
                }
            }
            .navigationTitle(Text(verbatim: item.title))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("gallery.done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    shareButton
                }
            }
        }
        .task { await model.loadVideoIfNeeded(item: item, api: session.api) }
        .sheet(item: $model.shareItem) { GalleryShareSheet(url: $0.url) }
        .alert("gallery.share.error", isPresented: $model.shareFailed) {
            Button("routines.common.ok", role: .cancel) {}
        }
    }

    // MARK: - Medium

    @ViewBuilder
    private var media: some View {
        if item.kind == .video {
            videoPlayer
        } else {
            MediaImage(key: item.storageKey, contentMode: .fit)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        }
    }

    @ViewBuilder
    private var videoPlayer: some View {
        switch model.videoState {
        case .ready:
            if let player = model.player {
                VideoPlayer(player: player)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
            }
        case .failed:
            videoStatus(icon: "exclamationmark.triangle", text: "gallery.video.error")
        case .idle, .loading:
            videoStatus(icon: nil, text: "gallery.video.loading")
        }
    }

    private func videoStatus(icon: String?, text: LocalizedStringKey) -> some View {
        VStack(spacing: Theme.Spacing.s3) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 28, weight: .regular))
                    .foregroundStyle(Theme.Colors.inkFaint)
            } else {
                ProgressView().tint(Theme.Colors.brand)
            }
            Text(text)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }

    // MARK: - Metadaten

    private var metadata: some View {
        HStack(spacing: Theme.Spacing.s3) {
            if let album = GalleryViewModel.normalizedAlbum(item) {
                Text(verbatim: album)
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.brandInk)
                    .padding(.horizontal, Theme.Spacing.s2)
                    .padding(.vertical, 3)
                    .background(Theme.Colors.brandSoft)
                    .clipShape(Capsule())
            }
            Label(GalleryDateFormat.medium(item.createdAt), systemImage: "calendar")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Teilen

    private var shareButton: some View {
        Button {
            _Concurrency.Task { await model.share(item: item, api: session.api) }
        } label: {
            if model.isPreparingShare {
                ProgressView()
            } else {
                Label("gallery.share", systemImage: "square.and.arrow.up")
            }
        }
        .disabled(model.isPreparingShare)
    }
}

/// Lokales Datum aus ISO-8601-`created_at` (mit/ohne Sekundenbruchteile),
/// als abgekürztes, lokalisiertes Datum. Fällt auf den Rohstring zurück.
enum GalleryDateFormat {
    private static let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    static func medium(_ raw: String) -> String {
        guard let date = withFractional.date(from: raw) ?? plain.date(from: raw) else {
            return raw
        }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

/// UIActivityViewController-Brücke fürs Teilen der (auth-)geladenen Datei.
struct GalleryShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
