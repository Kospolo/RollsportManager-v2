import SwiftUI

/// Mahnprotokoll (Historie) — unveränderliche Eskalations-Chronik (GoBD).
/// Newest first (das ViewModel sortiert). Jede Zeile trägt Aktion (Chip),
/// Rechnung + Mitglied, Stufen-Übergang, Notiz, Zeitpunkt und ausführende
/// Person. Reines Lesen: append-only, keine Bearbeitung/Löschung.
struct DunningHistoryCard: View {
    let log: [DunningLogEntry]
    let invoiceLookup: (String) -> Invoice?
    let memberNameLookup: (String) -> String?

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                header
                if log.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: Theme.Spacing.s3) {
                        ForEach(log, id: \.id) { entry in
                            let invoice = invoiceLookup(entry.invoiceId)
                            DunningLogRow(
                                entry: entry,
                                invoiceNumber: invoice?.number,
                                memberName: invoice.flatMap { memberNameLookup($0.memberId) },
                                actorName: entry.actorMemberId.flatMap(memberNameLookup)
                            )
                        }
                    }
                    footer
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s3) {
            RSMSectionHeader(eyebrow: "mahnungen.history.eyebrow", title: "mahnungen.history.title")
            Spacer(minLength: Theme.Spacing.s2)
            if !log.isEmpty {
                Text("mahnungen.history.count \(log.count)")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("mahnungen.history.empty.title")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text("mahnungen.history.empty.message")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s5)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .strokeBorder(Theme.Colors.line, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
        )
        .accessibilityElement(children: .combine)
    }

    private var footer: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "lock.fill")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text("mahnungen.history.immutable")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Aktion → Chip-Ton/Wort (Wort UND Farbe, Design-System §3.6).
private extension DunningLogAction {
    var pillKind: RSMStatusKind {
        switch self {
        case .reminder: .info
        case .dunning: .warn
        case .handover: .danger
        }
    }

    var labelKey: LocalizedStringKey {
        switch self {
        case .reminder: "mahnungen.action.reminder"
        case .dunning: "mahnungen.action.dunning"
        case .handover: "mahnungen.action.handover"
        }
    }
}

private struct DunningLogRow: View {
    let entry: DunningLogEntry
    let invoiceNumber: String?
    let memberName: String?
    let actorName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(spacing: Theme.Spacing.s2) {
                RSMStatusPill(text: entry.action.labelKey, kind: entry.action.pillKind)
                Text(verbatim: stageText)
                    .font(Theme.Fonts.monoCaption.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
                Spacer(minLength: Theme.Spacing.s2)
                Text(verbatim: DunningFormat.dateTime(entry.createdAt))
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                Text(verbatim: memberName ?? String(localized: "finance.member.unknown"))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                if let invoiceNumber {
                    Text(verbatim: invoiceNumber)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                Text("mahnungen.history.by \(actorName ?? String(localized: "mahnungen.history.system"))")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            if let note = entry.note, !note.isEmpty {
                Text(verbatim: note)
                    .font(Theme.Fonts.caption)
                    .italic()
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, Theme.Spacing.s3)
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(Theme.Colors.lineStrong)
                            .frame(width: 2)
                    }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var stageText: String {
        if let from = entry.fromStage {
            return String(
                format: NSLocalizedString("mahnungen.history.stage %lld %lld", comment: ""),
                from, entry.toStage ?? 0
            )
        }
        return String(
            format: NSLocalizedString("mahnungen.history.stageTo %lld", comment: ""),
            entry.toStage ?? 0
        )
    }
}
