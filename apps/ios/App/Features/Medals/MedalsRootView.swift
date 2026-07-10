import SwiftUI

/// Registry-Einhängepunkt des Medaillen-Features. Die `MehrCatalog`-Registry
/// (READ-ONLY, `Features/Mehr/MehrModel.swift`) verweist auf `MedalsRootView()`;
/// die echte Umsetzung liegt in `AchievementsView` (Root-View des Features,
/// `Features/Achievements/`). Diese View delegiert daher nur — so bleibt die
/// bestehende Registry unverändert und das Modul ist voll umgesetzt.
///
/// Wenn die Registry später direkt auf `AchievementsView()` zeigt, kann dieser
/// dünne Adapter entfallen.
/// Web-Referenz-UX: apps/web/app/(portal)/medaillen.
struct MedalsRootView: View {
    var body: some View {
        AchievementsView()
    }
}
