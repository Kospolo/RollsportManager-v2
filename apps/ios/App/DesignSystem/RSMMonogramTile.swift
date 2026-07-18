import SwiftUI

/// Monogramm-KACHEL — die grosse Schwester von `RSMAvatarView`.
///
/// WARUM EINE KACHEL UND KEIN KREIS: In der Mitgliederliste traegt die Flaeche
/// die Identitaet. Ein 40-pt-Kreis ist ein Aufzaehlungspunkt; eine 68-pt-Kachel
/// ist ein Portraet-Ersatz. Das Web loest das mit `PortraitTile` (Foto oder
/// gestaltetes Monogramm) — iOS zeigt NUR das Monogramm.
///
/// ⚠️ BEWUSST KEINE FOTOS: `members.ts` traegt keine Einwilligungs-Wache, und in
/// diesem Verein sind sehr viele Kinder. Ein Gesicht ohne gepruefte Einwilligung
/// wird hier nicht gerendert — die Identitaet kommt ueber Monogramm + Farbton.
/// Diese Ansicht nimmt darum gar keine `avatarUrl` entgegen: was es nicht gibt,
/// kann niemand versehentlich anschliessen.
///
/// Der Farbton kommt aus dem BESTEHENDEN Hash (`RSMAvatarTone.forId`) — „Lina
/// ist plum" gilt in Liste, Detail und Web identisch.
struct RSMMonogramTile: View {
    let name: String
    /// Stabile ID fuer den Farbton (z. B. `member_id`); Fallback: Name.
    var personId: String?
    /// Kantenlaenge bei Standard-Textgroesse.
    var size: CGFloat = 68

    /// Die Kachel waechst mit der Systemschrift mit — sonst steht bei grosser
    /// Schrift ein Briefmarken-Monogramm neben einem riesigen Namen. Gedeckelt,
    /// damit sie bei den Accessibility-Stufen nicht die halbe Zeile frisst.
    @ScaledMetric(relativeTo: .headline) private var scale: CGFloat = 1

    private var tone: RSMAvatarTone { .forId(personId ?? name) }

    private var side: CGFloat { min(size * scale, size * 1.35) }

    /// Radius waechst mit — sonst wird aus dem Rundquadrat bei grosser Schrift
    /// ein Quadrat mit angeknabberten Ecken.
    private var radius: CGFloat { Theme.Radius.xl * (side / size) }

    private var initials: String {
        let parts = name.split(separator: " ")
        let first = parts.first?.first.map(String.init) ?? ""
        let last = parts.count > 1 ? parts.last?.first.map(String.init) ?? "" : ""
        return (first + last).uppercased()
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(tone.fill)
            // Display-Schrift (SF Rounded, heavy): die Initialen sind hier ein
            // Gestaltungselement, kein Fliesstext. Groesse aus der Geometrie —
            // die Kachel skaliert bereits, der Text darf NICHT zusaetzlich
            // wachsen (sonst sprengt er die Kachel).
            Text(initials)
                .font(Theme.Fonts.display(size: side * 0.34))
                .foregroundStyle(tone.initialsColor)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true) // der Name steht immer als Text daneben
    }
}
