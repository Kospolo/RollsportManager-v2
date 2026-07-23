import SwiftUI

/// KPI-Reihe der Auswertung: Mitglieder gesamt, Anwesenheitsquote, offene
/// Posten und kommende Termine als vier Kacheln (2×2-Raster).
///
/// Baut auf dem geteilten `RSMKpiTile` auf (Eyebrow → Display-Zahl → Caption,
/// tabular). Farbe nur dort, wo sie eine Aussage trägt: die offenen Posten
/// leuchten warnend, sobald etwas offen ist, sonst zustimmend grün — die
/// übrigen Werte bleiben neutral (keine Farb-Girlande, „Status nie nur Farbe“:
/// jede Kachel trägt ihren Klartext).
struct ReportsKpiSection: View {
    let summary: ReportSummary

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        LazyVGrid(columns: RSMKpiTile.columns(for: dynamicTypeSize), spacing: Theme.Spacing.s3) {
            RSMKpiTile(
                eyebrow: "auswertung.kpi.members.eyebrow",
                value: "\(summary.membersTotal ?? 0)",
                caption: "auswertung.kpi.members.sub \(summary.membersActive ?? 0)"
            )
            RSMKpiTile(
                eyebrow: "auswertung.kpi.attendance.eyebrow",
                value: ReportsFormat.percentText(summary.attendanceRate ?? 0),
                caption: "auswertung.kpi.attendance.sub"
            )
            RSMKpiTile(
                eyebrow: "auswertung.kpi.open.eyebrow",
                value: ReportsFormat.euroText(cents: summary.openInvoicesTotalCents ?? 0),
                caption: openCaption,
                valueColor: openCount > 0 ? Theme.Colors.warn : Theme.Colors.success
            )
            RSMKpiTile(
                eyebrow: "auswertung.kpi.events.eyebrow",
                value: "\(summary.upcomingEventsCount ?? 0)",
                caption: eventsCaption
            )
        }
    }

    private var openCount: Int { summary.openInvoicesCount ?? 0 }

    private var openCaption: LocalizedStringKey {
        switch openCount {
        case 0: "auswertung.kpi.open.sub.none"
        case 1: "auswertung.kpi.open.sub.one"
        default: "auswertung.kpi.open.sub.other \(openCount)"
        }
    }

    private var eventsCaption: LocalizedStringKey {
        let shown = summary.upcomingEvents.count
        return shown == 0 ? "auswertung.kpi.events.sub.none" : "auswertung.kpi.events.sub \(shown)"
    }
}
