import SwiftUI

/// KPI-Karte: aktive Mitglieder + offene Beiträge nebeneinander,
/// darunter der nächste Termin als breite Kachel.
///
/// RLS-bewusst: Die Beitrags-Summe ist rollenabhängig gefiltert (member
/// sieht nur eigene Rechnungen, coach ggf. keine) — die Caption sagt darum
/// neutral „aus deiner Sicht“ statt eine Vereins-Gesamtsumme zu behaupten.
struct DashboardKpiRow: View {
    let data: DashboardData

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "dashboard.kpi.eyebrow",
                    title: "dashboard.kpi.title"
                )
                VStack(spacing: Theme.Spacing.s3) {
                    HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                        RSMKpiTile(
                            eyebrow: "dashboard.kpi.members.eyebrow",
                            value: "\(data.activeMemberCount)",
                            caption: "dashboard.kpi.members.caption"
                        )
                        RSMKpiTile(
                            eyebrow: "dashboard.kpi.dues.eyebrow",
                            value: DashboardFormat.euroText(cents: data.openInvoiceSumCents),
                            caption: duesCaption
                        )
                    }
                    nextEventTile
                }
            }
        }
    }

    private var duesCaption: LocalizedStringKey {
        switch data.openInvoiceCount {
        case 0: "dashboard.kpi.dues.caption.empty"
        case 1: "dashboard.kpi.dues.caption.one"
        default: "dashboard.kpi.dues.caption.other \(data.openInvoiceCount)"
        }
    }

    @ViewBuilder
    private var nextEventTile: some View {
        if let event = data.nextEvent,
           let start = DashboardFormat.parseISO(event.startsAt) {
            RSMKpiTile(
                eyebrow: "dashboard.kpi.next.eyebrow",
                value: DashboardFormat.relativeDayText(start),
                // Titel + Uhrzeit kommen von der API — bewusst kein Katalog-Key.
                caption: LocalizedStringKey(
                    "\(event.title) · \(DashboardFormat.timeText(start))"
                )
            )
        } else {
            RSMKpiTile(
                eyebrow: "dashboard.kpi.next.eyebrow",
                value: "—",
                caption: "dashboard.kpi.next.caption.none"
            )
        }
    }
}
