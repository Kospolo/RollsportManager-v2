import SwiftUI

/// Wiederverwendbare Check-in-Liste (neueste zuerst): pro Zeile die
/// Erfassungsart (QR/Manuell), optional der Mitgliedsname (Vereins-Historie),
/// der Termin-Bezug und der Zeitpunkt (Web: CheckinList). `onDelete` blendet die
/// Löschen-Aktion ein — die zeigen wir NUR in der Vereins-Historie des
/// Trainerstabs (Web-Parität: `onDelete` nur an `ClubCheckins`).
struct CheckinList: View {
    let entries: [Checkin]
    /// Mitgliedsname anzeigen (nur in der Vereins-Historie des Trainerstabs).
    let showMemberName: Bool
    let memberName: (String) -> String
    let eventTitle: (String?) -> String?
    let emptyTitle: LocalizedStringKey
    let emptyBody: LocalizedStringKey
    /// Optionale Löschen-Aktion je Zeile (nil ⇒ keine Aktion, reine Ansicht).
    var onDelete: ((Checkin) -> Void)? = nil

    var body: some View {
        if entries.isEmpty {
            RSMCard {
                RSMEmptyState(systemImage: "clock", title: emptyTitle, message: emptyBody)
            }
        } else {
            VStack(spacing: Theme.Spacing.s3) {
                ForEach(entries, id: \.id) { entry in
                    RSMCard {
                        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                            row(entry)
                            if let onDelete {
                                deleteButton(entry, onDelete)
                            }
                        }
                    }
                }
            }
        }
    }

    /// Ghost-Löschen-Knopf (≥ 44 pt Touch-Ziel), Danger-Tint. Auslösen öffnet
    /// nur den Bestätigungsdialog — gelöscht wird ausschliesslich dort.
    private func deleteButton(_ entry: Checkin, _ onDelete: @escaping (Checkin) -> Void) -> some View {
        Button {
            onDelete(entry)
        } label: {
            Image(systemName: "trash")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.danger)
                .frame(minWidth: Theme.Size.touchTarget, minHeight: Theme.Size.touchTarget)
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(verbatim: "Check-in löschen"))
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
    /// Check-in, dessen Löschen gerade bestätigt wird (nil = kein Dialog). Nie
    /// automatisch bestätigt — gelöscht wird nur über den Dialog-Button.
    @State private var toDelete: Checkin?

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
                emptyBody: "checkin.club.emptyBody",
                onDelete: { toDelete = $0 }
            )
        }
        .confirmationDialog(
            Text(verbatim: "Check-in löschen"),
            isPresented: deleteConfirmBinding,
            titleVisibility: .visible,
            presenting: toDelete
        ) { checkin in
            Button(role: .destructive) {
                let target = checkin
                toDelete = nil
                _Concurrency.Task { await model.deleteCheckin(target) }
            } label: {
                Text(verbatim: "Löschen")
            }
            Button(role: .cancel) { toDelete = nil } label: {
                Text(verbatim: "Abbrechen")
            }
        } message: { _ in
            Text(verbatim: "Dieser Check-in wird entfernt. Das lässt sich nicht rückgängig machen.")
        }
        .alert(Text(verbatim: "Löschen fehlgeschlagen"), isPresented: deleteErrorBinding) {
            Button("checkin.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.deleteErrorMessage ?? "")
        }
    }

    private var deleteConfirmBinding: Binding<Bool> {
        Binding(
            get: { toDelete != nil },
            set: { if !$0 { toDelete = nil } }
        )
    }

    private var deleteErrorBinding: Binding<Bool> {
        Binding(
            get: { model.deleteErrorMessage != nil },
            set: { if !$0 { model.deleteErrorMessage = nil } }
        )
    }
}
