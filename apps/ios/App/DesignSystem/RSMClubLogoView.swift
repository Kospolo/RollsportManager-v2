import SwiftUI
import UIKit

// ============================================================================
// Das Vereinslogo als Ansicht (Migration 0060).
//
// Anders als alle anderen Medien der App braucht dieses KEIN Bearer-Token:
// GET /public/clubs/{id}/logo ist bewusst öffentlich (Marken-Asset, steht auch
// auf Login/Landing). Deshalb reicht hier ein schlichter URL-Load — der
// auth-tragende `MediaImageStore` wäre falsch am Platz.
//
// Hat der Verein kein Logo, antwortet die Route 404. Dann zeigt die Ansicht
// wahlweise gar nichts (`hidesWhenMissing`, für dezente Stellen) oder einen
// neutralen Platzhalter mit Wappen-Symbol.
// ============================================================================

/// Prozessweiter Cache für Vereinslogos (klein: ein Logo je Verein) inklusive
/// „gibt es nicht"-Merker, damit ein fehlendes Logo nicht bei jedem Erscheinen
/// erneut angefragt wird.
@MainActor
final class ClubLogoStore: ObservableObject {
    static let shared = ClubLogoStore()

    private var images: [String: UIImage] = [:]
    private var missing: Set<String> = []
    private var inFlight: [String: _Concurrency.Task<UIImage?, Never>] = [:]

    private init() {}

    func cached(_ clubId: String) -> UIImage? { images[clubId] }
    func isKnownMissing(_ clubId: String) -> Bool { missing.contains(clubId) }

    /// Lädt das Logo (öffentlich, ohne Token). `nil` = der Verein hat keines
    /// bzw. es ist nicht abrufbar — das ist kein Fehlerfall fürs UI.
    func logo(clubId: String, url: URL) async -> UIImage? {
        if let hit = images[clubId] { return hit }
        if missing.contains(clubId) { return nil }
        if let running = inFlight[clubId] { return await running.value }

        let task = _Concurrency.Task<UIImage?, Never> {
            guard
                let (data, response) = try? await URLSession.shared.data(from: url),
                let http = response as? HTTPURLResponse,
                (200..<300).contains(http.statusCode),
                let image = UIImage(data: data)
            else { return nil }
            return image
        }
        inFlight[clubId] = task
        let image = await task.value
        inFlight[clubId] = nil

        if let image {
            images[clubId] = image
        } else {
            missing.insert(clubId)
        }
        return image
    }

    /// Nach einem Upload/Löschen den Merker verwerfen, damit das neue Logo
    /// (oder dessen Abwesenheit) sofort greift.
    func invalidate(clubId: String) {
        images[clubId] = nil
        missing.remove(clubId)
    }
}

/// Zeigt das Vereinslogo als abgerundetes Quadrat.
struct RSMClubLogoView: View {
    let clubId: String
    var size: CGFloat = 44
    /// `true` = bei fehlendem Logo GAR NICHTS rendern (für dezente Stellen wie
    /// den Profilkopf); `false` = neutraler Platzhalter.
    var hidesWhenMissing: Bool = false
    /// Erzwingt einen Neuladeversuch, wenn sich der Wert ändert (nach Upload).
    var reloadToken: String = ""

    @EnvironmentObject private var session: SessionStore
    @State private var image: UIImage?
    @State private var isLoading = false

    var body: some View {
        // ZStack ist hier KEINE Kosmetik: mit `hidesWhenMissing` ist `content`
        // im Ruhezustand ein EmptyView — Modifier an einem EmptyView werden
        // nicht angehängt, `.task` lief dann NIE und das Logo blieb unsichtbar
        // (im Simulator gemessen). Der ZStack ist die echte Ansicht, die den
        // Ladeauftrag trägt; ohne Inhalt bleibt er null Punkte groß.
        ZStack { content }
            .task(id: "\(clubId)|\(reloadToken)") { await load() }
    }

    @ViewBuilder
    private var content: some View {
        if let image {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .padding(size * 0.08)
                .frame(width: size, height: size)
                .background(Theme.Colors.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                        .strokeBorder(Theme.Colors.line, lineWidth: 1)
                )
                .accessibilityLabel(Text("club.logo.a11y"))
        } else if isLoading {
            placeholder(systemImage: "photo")
                .overlay(ProgressView().tint(Theme.Colors.inkFaint))
        } else if !hidesWhenMissing {
            placeholder(systemImage: "shield.lefthalf.filled")
                .accessibilityLabel(Text("club.logo.none.a11y"))
        }
    }

    private func placeholder(systemImage: String) -> some View {
        RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
            .fill(Theme.Colors.bgSunken)
            .frame(width: size, height: size)
            .overlay(
                Image(systemName: systemImage)
                    .font(.system(size: size * 0.4, weight: .medium))
                    .foregroundStyle(Theme.Colors.inkFaint)
            )
    }

    private func load() async {
        if let hit = ClubLogoStore.shared.cached(clubId) {
            image = hit
            return
        }
        if ClubLogoStore.shared.isKnownMissing(clubId) {
            image = nil
            return
        }
        isLoading = true
        defer { isLoading = false }
        image = await ClubLogoStore.shared.logo(
            clubId: clubId,
            url: session.api.clubLogoURL(clubId: clubId)
        )
    }
}
