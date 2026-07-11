import SwiftUI

/// Ampel-Gruppe einer Mahnstufe (0–3): Kopf mit Stufen-Badge, Anzahl und Summe
/// (Mono), darunter die offenen Posten dieser Stufe. Leere Stufen zeigen eine
/// dezente Zeile statt einer Tabelle — die Treppe bleibt sichtbar.
///
/// Eskalationsfarbe NUR am Badge (RSMStatusPill.dunning) — nie die ganze Zeile
/// einfärben. Ein Tipp auf die Zeile öffnet die E-Mail-Vorschau (reines Lesen).
struct DunningStageGroupCard: View {
    let bucket: DunningStageBucket
    let currencyCode: String
    /// Öffnet die Mahn-E-Mail eines Postens (Modal, nur Lesen).
    let onPreviewMail: (_ invoiceId: String, _ stage: Int) -> Void

    private var titleKey: LocalizedStringKey {
        switch bucket.level {
        case 0: "mahnungen.stage0.title"
        case 1: "mahnungen.stage1.title"
        case 2: "mahnungen.stage2.title"
        default: "mahnungen.stage3.title"
        }
    }

    /// Zielstufe der Vorschau-Mail: Stufe 0 zeigt die anstehende Erinnerung (1).
    private var mailStage: Int { bucket.level == 0 ? 1 : min(3, bucket.level) }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                header
                if bucket.items.isEmpty {
                    emptyRow
                } else {
                    rows
                }
            }
        }
    }

    // MARK: - Kopf

    private var header: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("mahnungen.stage.eyebrow \(bucket.level)")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
                HStack(spacing: Theme.Spacing.s2) {
                    RSMStatusPill.dunning(level: bucket.level)
                    Text(titleKey)
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Theme.Spacing.s2)
            Text("mahnungen.stage.meta \(bucket.items.count) \(FinanceFormat.amount(cents: bucket.sumCents, currency: currencyCode))")
                .font(Theme.Fonts.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkSoft)
                .multilineTextAlignment(.trailing)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    private var emptyRow: some View {
        Text("mahnungen.stage.empty")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkFaint)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.s4)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                    .strokeBorder(Theme.Colors.line, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
            )
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(bucket.items) { item in
                if item.id != bucket.items.first?.id {
                    Divider().overlay(Theme.Colors.line)
                }
                DunningItemRow(item: item, currencyCode: currencyCode) {
                    onPreviewMail(item.invoice.id, mailStage)
                }
            }
        }
    }
}

/// Eine Ampel-Zeile: [Avatar] Name + Beitrittsjahr · Rechnung … Betrag Mono +
/// Fälligkeitstext. Tipp öffnet die E-Mail-Vorschau. Betrag nie eingefärbt.
private struct DunningItemRow: View {
    let item: DunningItem
    let currencyCode: String
    let action: () -> Void

    private var displayName: String {
        item.memberName ?? String(localized: "finance.member.unknown")
    }

    private var amountText: String {
        FinanceFormat.amount(cents: item.invoice.amountCents, currency: currencyCode)
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s3) {
                RSMAvatarView(name: displayName, personId: item.invoice.memberId, size: 36)
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text(verbatim: displayName)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    HStack(spacing: Theme.Spacing.s2) {
                        Text(verbatim: item.invoice.number)
                            .font(Theme.Fonts.monoTable)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Colors.inkFaint)
                        if let year = item.memberJoinYear {
                            Text("mahnungen.member.since \(year)")
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkFaint)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: Theme.Spacing.s2)
                VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                    Text(verbatim: amountText)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    dueLabel
                }
                Image(systemName: "envelope")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.listRow)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("mahnungen.a11y.previewMail \(displayName)"))
        .accessibilityValue(Text(verbatim: "\(item.invoice.number), \(amountText)"))
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder
    private var dueLabel: some View {
        if item.overdue {
            overdueText
                .font(Theme.Fonts.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
        } else if let due = FinanceFormat.date(item.invoice.dueOn) {
            Text("mahnungen.due.upcoming \(due)")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
                .lineLimit(1)
        }
    }

    /// Text über die LocalizedStringKey-Interpolation bauen (nie über
    /// `LocalizedStringKey("… \(x)")` — dessen Initializer bäckt den Wert in
    /// den Key statt einen `%lld`-Platzhalter zu erzeugen).
    private var overdueText: Text {
        item.overdueDays == 1
            ? Text("mahnungen.overdue.one")
            : Text("mahnungen.overdue.many \(item.overdueDays)")
    }
}
