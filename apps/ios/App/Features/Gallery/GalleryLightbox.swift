import SwiftUI
#if canImport(UIKit)
import UIKit
#else
// macOS: AppKit statt UIKit. Die hier benutzten UIKit-Namen
// (UIImage/UIScreen/UIAccessibility) liefert AppMac/MacPlatformShims.swift.
import AppKit
#endif
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

// Teilen der (auth-)geladenen Datei — dieselbe Aufgabe, zwei Systeme.
//
// Das ist eine der wenigen Stellen, an denen ein Shim NICHT reicht: iOS teilt
// über ein modales Blatt (`UIActivityViewController`), der Mac über ein Popover
// am auslösenden Element (`NSSharingServicePicker`). Beides in einen
// gemeinsamen Namen zu pressen würde auf einer der Plattformen falsch aussehen.

#if os(iOS)
/// UIActivityViewController-Brücke fürs Teilen der (auth-)geladenen Datei.
struct GalleryShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
#else
/// Mac-Pendant: `NSSharingServicePicker` in einem kleinen Blatt. Es zeigt
/// dieselben Ziele wie das iOS-Blatt (Mail, Nachrichten, AirDrop, Finder-
/// Aktionen) und schließt sich, sobald der Nutzer eines gewählt oder abgebrochen
/// hat.
struct GalleryShareSheet: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var didPresent = false

    var body: some View {
        VStack(spacing: Theme.Spacing.s4) {
            Text("gallery.share.title")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(url.lastPathComponent)
                .font(Theme.Fonts.monoCaption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
                .truncationMode(.middle)
            MacSharingAnchor(url: url, isPresented: $didPresent) { dismiss() }
                .frame(width: 220, height: 32)
            Button("common.close") { dismiss() }
                .keyboardShortcut(.cancelAction)
        }
        .padding(Theme.Spacing.s5)
        .frame(minWidth: 320)
        .background(Theme.Colors.bgSurface)
        .onAppear { didPresent = true }
    }
}

/// Ankerpunkt für den `NSSharingServicePicker` (er braucht eine echte
/// AppKit-View, an der das Popover hängt).
private struct MacSharingAnchor: NSViewRepresentable {
    let url: URL
    @Binding var isPresented: Bool
    let onFinish: () -> Void

    func makeNSView(context: Context) -> NSView { NSView() }

    func updateNSView(_ view: NSView, context: Context) {
        guard isPresented, view.window != nil else { return }
        DispatchQueue.main.async {
            isPresented = false
            let picker = NSSharingServicePicker(items: [url])
            picker.delegate = context.coordinator
            picker.show(relativeTo: view.bounds, of: view, preferredEdge: .minY)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, NSSharingServicePickerDelegate {
        private let onFinish: () -> Void
        init(onFinish: @escaping () -> Void) { self.onFinish = onFinish }

        func sharingServicePicker(
            _ picker: NSSharingServicePicker,
            didChoose service: NSSharingService?
        ) {
            onFinish()
        }
    }
}
#endif
