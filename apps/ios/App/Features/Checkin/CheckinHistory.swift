import SwiftUI

/// Wiederverwendbare Check-in-Liste (neueste zuerst): pro Zeile die
/// Erfassungsart (QR/Manuell), optional der Mitgliedsname (Vereins-Historie),
/// der Termin-Bezug und der Zeitpunkt (Web: CheckinList). Ein Löschen bietet die
/// native Ansicht bewusst NICHT an — dafür fehlt der Endpoint (siehe RootView).
struct CheckinList: View {
    let entries: [Checkin]
    /// Mitgliedsname anzeigen (nur in der Vereins-Historie des Trainerstabs).
    let showMemberName: Bool
    let memberName: (String) -> String
    let eventTitle: (String?) -> String?
    let emptyTitle: LocalizedStringKey
    let emptyBody: LocalizedStringKey

    var body: some View {
        if entries.isEmpty {
            RSMCard {
                RSMEmptyState(systemImage: "clock", title: emptyTitle, message: emptyBody)
            }
        } else {
            VStack(spacing: Theme.Spacing.s3) {
                ForEach(entries, id: \.id) { entry in
                    RSMCard { row(entry) }
                }
            }
        }
    }

    private func row(_ entry: Checkin) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            if showMemberName {
                Text(verbatim: memberName(entry.memberId))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
            }
            HStack(spacing: Theme.Spacing.s2) {
                CheckinMethodBadge(method: entry.method)
                if let title = eventTitle(entry.eventId) {
                    CheckinVerbatimChip(text: title)
                }
                Spacer(minLength: 0)
            }
            Text(verbatim: CheckinLogic.dateTime(entry.checkedInAt))
                .font(Theme.Fonts.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Vereins-Check-ins (nur Trainerstab): Kennzahlen (gesamt/Woche/Monat) plus die
/// vollständige Historie des Vereins mit Mitgliedsname, Termin und Zeitpunkt
/// (Web: ClubCheckins). Rein lesend.
struct ClubCheckinsSection: View {
    @ObservedObject var model: CheckinViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            CheckinSectionHeader(title: "checkin.club.title", subtitle: "checkin.club.sub")

            let stats = model.stats
            HStack(spacing: Theme.Spacing.s3) {
                RSMKpiTile(eyebrow: "checkin.kpi.total", value: "\(stats.total)")
                RSMKpiTile(eyebrow: "checkin.kpi.week", value: "\(stats.thisWeek)", valueColor: Theme.Colors.info)
                RSMKpiTile(eyebrow: "checkin.kpi.month", value: "\(stats.thisMonth)", valueColor: Theme.Colors.success)
            }

            CheckinList(
                entries: model.clubCheckins,
                showMemberName: true,
                memberName: model.memberName,
                eventTitle: model.eventTitle,
                emptyTitle: "checkin.club.emptyTitle",
                emptyBody: "checkin.club.emptyBody"
            )
        }
    }
}
