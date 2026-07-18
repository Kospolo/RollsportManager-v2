import SwiftUI

// ============================================================================
// Der VEREIN im Kopf der App.
//
// Vorher stand dort „Uebersicht" — ein Wort, das nichts ueber den Verein sagt
// und den Platz belegte, an dem die Marke haette stehen koennen. Das
// Vereinslogo existierte in der App nur an zwei versteckten Stellen
// (AdminClubLogoCard mit 72 pt, ProfileHeaderCard mit 24 pt), und der
// VEREINSNAME kam auf dem Dashboard ueberhaupt nicht vor.
//
// FALLBACK OHNE LOCH: Hat der Verein kein Logo, faellt die Kachel ersatzlos weg
// (`hidesWhenMissing`) und der Name traegt den Kopf allein — eine Wortmarke.
// Bewusst KEIN Monogramm-Ersatz: Monogramme sind laut Design-System Menschen
// vorbehalten, Organisationen bekommen Icon-Kacheln (Radius `org`, Jury-Fix).
// Ein Platzhalter-Schild waere hier genau das „Loch", das es zu vermeiden gilt.
// ============================================================================

/// Laedt und cached den Vereins-STAMMSATZ (bisher nur der Name) prozessweit.
/// GET /clubs/{id} darf jedes Mitglied lesen (RLS: `app.is_club_member`).
@MainActor
final class ClubIdentityStore: ObservableObject {
    static let shared = ClubIdentityStore()

    @Published private(set) var names: [String: String] = [:]
    private var inFlight: Set<String> = []

    private init() {}

    func name(for clubId: String) -> String? { names[clubId] }

    /// Still: schlaegt der Aufruf fehl (Transport, Rechte), bleibt der Kopf
    /// eben ohne Namen — das ist kein Fehlerzustand fuer den Nutzer.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard names[clubId] == nil, !inFlight.contains(clubId) else { return }
        inFlight.insert(clubId)
        defer { inFlight.remove(clubId) }
        if let club = try? await api.getClub(clubId: clubId) {
            names[clubId] = club.name
        }
    }
}

/// Kompakte Vereins-Kopfzeile fuer die Navigationsleiste: Logo + Name.
/// Sitzt als `.principal`-Toolbar-Item dort, wo vorher der Screen-Titel stand.
struct RSMClubHeader: View {
    let clubId: String
    /// Kantenlaenge des Logos bei Standard-Textgroesse.
    var logoSize: CGFloat = 26

    @EnvironmentObject private var session: SessionStore
    @StateObject private var identity = ClubIdentityStore.shared

    var body: some View {
        HStack(spacing: Theme.Spacing.s2) {
            RSMClubLogoView(clubId: clubId, size: logoSize, hidesWhenMissing: true)
            if let name = identity.name(for: clubId) {
                Text(verbatim: name)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    // Eine Zeile: die Navigationsleiste darf nicht wachsen.
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .task { await identity.loadIfNeeded(api: session.api, clubId: clubId) }
        .accessibilityElement(children: .combine)
    }
}
