import SwiftUI

/// Registry-Einhängepunkt des Wettkampf-Moduls (Web-Referenz:
/// /(portal)/wettkampf). `MehrCatalog`/Deeplinks verweisen auf
/// `CompetitionRootView()` — dieser Typname bleibt der stabile Aufrufpunkt und
/// delegiert an die öffentliche Root-View `CompetitionsView`, in der die native
/// Umsetzung liegt (Liste + `CompetitionStandings`-Tableau je Kategorie,
/// RollArt-Wertung via `saveRoutineScore`), analog `NewsRootView` → `NewsView`.
struct CompetitionRootView: View {
    var body: some View {
        CompetitionsView()
    }
}
