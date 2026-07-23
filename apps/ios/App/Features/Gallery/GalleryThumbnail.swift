import SwiftUI

/// Quadratische Galerie-Kachel (Web-Referenz: GalleryCard): auth-getragenes
/// Vorschaubild über `MediaImage` (Thumbnail-Key, sonst Original), unten ein
/// Verlauf mit Album-Eyebrow + Titel, Videos mit Play-Overlay & Badge.
struct GalleryThumbnail: View {
    let item: GalleryItem

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var isVideo: Bool { item.kind == .video }
    private var album: String? { GalleryViewModel.normalizedAlbum(item) }

    var body: some View {
        // Ab Accessibility-Groesse wandert die Beschriftung UNTER das Bild.
        //
        // Bisher lag sie als Overlay im Quadrat und war auf AX1 gedeckelt, mit
        // der Begruendung: die Zeile ist dekorativ, den vollen Titel liest
        // VoiceOver am Kachel-Knopf. Fuer VoiceOver stimmt das — aber nicht
        // jede/r mit grosser Schrift benutzt VoiceOver. Wer nur die Schrift
        // hochdreht, las zuletzt „Kür-Mitschnitt Charlotte (A…" und
        // „SOMMERFES…" und hatte keinen zweiten Weg zum vollen Titel.
        // Unter dem Bild braucht die Beschriftung keinen Deckel mehr: sie
        // verdeckt nichts und darf so hoch werden, wie sie will.
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                square
                stackedCaption
            }
        } else {
            square.overlay(alignment: .bottomLeading) { caption }
        }
    }

    private var square: some View {
        // Das Quadrat wird von einer leeren Fläche AUFGESPANNT, das Bild liegt
        // als Overlay darin und wird beschnitten. Vorher spannte das Bild das
        // Quadrat selbst auf — ein breites Foto machte die Kachel mit
        // `contentMode: .fill` dann breiter als ihre Rasterzelle und lief
        // sichtbar links aus dem Raster heraus (belegt im Screenshot: die
        // erste Kachel überlappte den Bildschirmrand).
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay { MediaImage(key: item.thumbnailKey ?? item.storageKey, contentMode: .fill) }
            .clipped()
            .overlay { if isVideo { videoOverlay } }
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                    .stroke(Theme.Colors.line, lineWidth: 1)
            )
    }

    /// Beschriftung UNTER dem Bild (Accessibility-Groessen): kein Verlauf,
    /// keine Deckelung, kein Kuerzen — Album und Titel vollstaendig.
    private var stackedCaption: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let album {
                Text(verbatim: album)
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(verbatim: item.title)
                .font(Theme.Fonts.caption.weight(.bold))
                .foregroundStyle(Theme.Colors.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Wie die Overlay-Variante: der Kachel-Knopf traegt das VoiceOver-Label
        // (GalleryRootView), sonst wuerde der Titel doppelt vorgelesen.
        .accessibilityHidden(true)
    }

    // Verlauf + Album/Titel unten (dekorativ, Klick fällt auf die Kachel).
    private var caption: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let album {
                Text(verbatim: album)
                    // Vorher 9 pt fest — jetzt die Eyebrow-Rolle, die mitwächst.
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1)
            }
            Text(verbatim: item.title)
                // Vorher 12 pt fest — jetzt die Caption-Rolle in fett.
                .font(Theme.Fonts.caption.weight(.bold))
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
        // Die Kachel ist ein QUADRAT fester Seitenlänge: ab AX2 würde die
        // Bildunterschrift das Foto zudecken. Sie wächst deshalb mit, aber
        // gedeckelt. Kein Informationsverlust — die Zeile ist dekorativ, den
        // vollen Titel liest VoiceOver am Kachel-Knopf (GalleryRootView).
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
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
                // Vorher 10 pt fest — jetzt die Eyebrow-Rolle.
                .font(Theme.Fonts.eyebrow)
                .foregroundStyle(.white)
                .padding(.horizontal, Theme.Spacing.s2)
                .padding(.vertical, 2)
                .background(.black.opacity(0.55))
                .clipShape(Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(Theme.Spacing.s2)
        }
        // Gleiche Deckelung wie bei der Bildunterschrift — das Badge sitzt in
        // derselben festen Quadrat-Geometrie.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .accessibilityHidden(true)
    }
}
