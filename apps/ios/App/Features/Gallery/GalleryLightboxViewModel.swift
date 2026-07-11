import Foundation
import AVFoundation

/// Identifizierbarer Wrapper für `.sheet(item:)` beim Teilen.
struct GalleryShareItem: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

/// Zustand/Steuerung der Lightbox: lädt Video-Bytes auth-getragen in eine
/// temporäre Datei (für den nativen `AVPlayer`) und bereitet dieselbe Datei
/// fürs Teilen vor. Ein Download pro Eintrag wird wiederverwendet.
@MainActor
final class GalleryLightboxViewModel: ObservableObject {

    enum VideoState: Equatable {
        case idle
        case loading
        case ready
        case failed
    }

    @Published private(set) var videoState: VideoState = .idle
    @Published private(set) var player: AVPlayer?
    /// Treibt das Teilen-Sheet (nil = geschlossen).
    @Published var shareItem: GalleryShareItem?
    @Published var isPreparingShare = false
    @Published var shareFailed = false

    /// Gecachte lokale Datei (Playback + Teilen teilen sich denselben Download).
    private var localFile: URL?

    /// Lädt das Video (nur `kind == .video`) einmalig in eine temporäre Datei
    /// und erstellt daraus den `AVPlayer` (Autoplay wie im Web).
    func loadVideoIfNeeded(item: GalleryItem, api: APIClient) async {
        guard item.kind == .video else { return }
        if videoState == .ready || videoState == .loading { return }
        videoState = .loading
        do {
            let url = try await ensureLocalFile(item: item, api: api)
            let player = AVPlayer(url: url)
            self.player = player
            videoState = .ready
            player.play()
        } catch {
            videoState = .failed
        }
    }

    /// Bereitet die Datei fürs Teilen vor (lädt bei Bedarf) und öffnet das Sheet.
    func share(item: GalleryItem, api: APIClient) async {
        if let localFile {
            shareItem = GalleryShareItem(url: localFile)
            return
        }
        isPreparingShare = true
        defer { isPreparingShare = false }
        do {
            let url = try await ensureLocalFile(item: item, api: api)
            shareItem = GalleryShareItem(url: url)
        } catch {
            shareFailed = true
        }
    }

    private func ensureLocalFile(item: GalleryItem, api: APIClient) async throws -> URL {
        if let localFile { return localFile }
        let url = try await api.downloadMedia(key: item.storageKey, suggestedName: item.title)
        localFile = url
        return url
    }
}
