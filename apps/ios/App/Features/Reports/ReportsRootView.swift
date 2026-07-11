import SwiftUI

/// Registry-Einhängepunkt des Auswertung-Moduls
/// (Web-Referenz: /(portal)/auswertung). `MehrCatalog` (READ-ONLY) verweist
/// auf `ReportsRootView()`.
///
/// Die echte Umsetzung liegt in `ReportsView` (öffentliche Root-View des
/// Features). Diese View delegiert nur — so bleibt die bestehende Registry
/// (`MehrCatalog` → `ReportsRootView()`) unverändert und das Modul ist voll
/// umgesetzt: Kennzahlen aus `APIClient.getReportsSummary(clubId:)` →
/// `ReportSummary`. Nur Trainerstab/Vereinsleitung — sonst ein freundlicher
/// Kein-Zugriff-Hinweis; ein Server-403 (`member`/`guest`) wird ebenso
/// abgefangen.
///
/// Zeigt die Registry später direkt auf `ReportsView()`, kann dieser dünne
/// Adapter entfallen. Web-Referenz-UX: `apps/web/app/(portal)/auswertung`.
struct ReportsRootView: View {
    var body: some View {
        ReportsView()
    }
}
