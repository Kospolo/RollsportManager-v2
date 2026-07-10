import SwiftUI

/// Ergebnis-Sheet des Vorschau-Mahnlaufs (dry_run): Banner „nichts wurde
/// versendet“, Zusammenfassung, dann die Aktionen gruppiert nach
/// automatisch / wartet auf Freigabe / keine Aktion.
struct FinanceDunningPreviewSheet: View {
    let result: DunningRunResult
    /// member_id → Anzeigename (kann leer sein, dann trägt die Nummer die Zeile).
    let memberNames: [String: String]

    @Environment(\.dismiss) private var dismiss

    private var groups: [(kind: DunningActionAction, actions: [DunningAction])] {
        DunningActionAction.allCases.map { kind in
            (kind, result.actions.filter { $0.action == kind })
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    banner
                    if result.actions.isEmpty {
                        RSMCard {
                            RSMEmptyState(
                                systemImage: "tray",
                                title: "finance.preview.empty.title",
                                message: "finance.preview.empty.message"
                            )
                        }
                    } else {
                        ForEach(groups, id: \.kind) { group in
                            if !group.actions.isEmpty {
                                groupCard(kind: group.kind, actions: group.actions)
                            }
                        }
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("finance.preview.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Text("finance.preview.close")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.brandInk)
                    }
                    .accessibilityLabel(Text("finance.preview.close"))
                }
            }
        }
    }

    // MARK: - Banner + Zusammenfassung

    private var banner: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "eye.fill")
                .foregroundStyle(Theme.Colors.info)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("finance.preview.banner")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.info)
                Text("finance.preview.summary \(result.summary.auto) \(result.summary.pendingApproval) \(result.summary.none)")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
                if let asOf = FinanceFormat.date(result.asOf) {
                    Text("finance.preview.asOf \(asOf)")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.infoSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: - Gruppen

    private func groupTitle(_ kind: DunningActionAction) -> LocalizedStringKey {
        switch kind {
        case .auto: "finance.preview.group.auto"
        case .pendingApproval: "finance.preview.group.pending"
        case .none: "finance.preview.group.none"
        }
    }

    private func groupPillKind(_ kind: DunningActionAction) -> RSMStatusKind {
        switch kind {
        case .auto: .info
        case .pendingApproval: .warn
        case .none: .neutral
        }
    }

    private func groupCard(kind: DunningActionAction, actions: [DunningAction]) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(spacing: Theme.Spacing.s2) {
                    RSMStatusPill(text: groupTitle(kind), kind: groupPillKind(kind))
                    Text(verbatim: "\(actions.count)")
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                .accessibilityElement(children: .combine)
                VStack(spacing: 0) {
                    ForEach(actions, id: \.invoiceId) { action in
                        if action.invoiceId != actions.first?.invoiceId {
                            Divider().overlay(Theme.Colors.line)
                        }
                        actionRow(action)
                    }
                }
            }
        }
    }

    // MARK: - Zeile

    private func actionRow(_ action: DunningAction) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: memberNames[action.memberId]
                    ?? String(localized: "finance.member.unknown"))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                Spacer(minLength: Theme.Spacing.s2)
                // Contracts-Lücke: DunningAction führt keine Währung —
                // Annahme EUR (Seed), s. offene Punkte.
                Text(verbatim: FinanceFormat.amount(cents: action.amountCents, currency: "EUR"))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            HStack(spacing: Theme.Spacing.s2) {
                Text(verbatim: action.number)
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
                Text("finance.preview.overdue \(action.daysOverdue)")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
                Spacer(minLength: Theme.Spacing.s2)
                if action.action != .none {
                    RSMStatusPill.dunning(level: action.proposedLevel)
                    Text("finance.preview.level \(action.currentLevel) \(action.proposedLevel)")
                        .font(Theme.Fonts.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
        }
        .padding(.vertical, Theme.Spacing.s3)
        .accessibilityElement(children: .combine)
    }
}
