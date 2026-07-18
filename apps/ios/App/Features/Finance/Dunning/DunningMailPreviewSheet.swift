import SwiftUI

/// E-Mail-Vorschau der Mahn-Automatik („Vor jedem Versand siehst du die E-Mail
/// pro Empfänger"). Anrede, Beträge und Fristen kommen aus der konkreten
/// Rechnung; die Stufe bestimmt Betreff und Tonlage. REIN LESEND — hier wird
/// nichts versendet (der scharfe Versand läuft ausschließlich über den
/// Mahnlauf mit ausdrücklicher Freigabe).
struct DunningMailPreviewSheet: View {
    let invoice: Invoice
    let memberName: String
    let memberEmail: String?
    let senderName: String
    let senderEmail: String?
    let currencyCode: String
    /// 1 = Erinnerung · 2 = 1. Mahnung · 3 = 2. Mahnung.
    @State var stage: Int

    @Environment(\.dismiss) private var dismiss

    private var amount: String { FinanceFormat.amount(cents: invoice.amountCents, currency: currencyCode) }
    private var due: String { FinanceFormat.date(invoice.dueOn) ?? "—" }

    private var subject: String {
        String(format: NSLocalizedString("mahnungen.mail.subject\(stage)", comment: ""), invoice.number)
    }

    private var bodyText: String {
        String(
            format: NSLocalizedString("mahnungen.mail.body\(stage)", comment: ""),
            memberName, invoice.number, amount, due, senderName
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    stagePicker
                    RSMCard(padding: Theme.Spacing.s4) {
                        VStack(alignment: .leading, spacing: 0) {
                            fieldRow("mahnungen.mail.from", "\(senderName) <\(senderEmail ?? "")>")
                            Divider().overlay(Theme.Colors.line)
                            fieldRow("mahnungen.mail.to", "\(memberName) <\(memberEmail ?? String(localized: "mahnungen.mail.noEmail"))>")
                            Divider().overlay(Theme.Colors.line)
                            fieldRow("mahnungen.mail.subject", subject)
                        }
                    }
                    Text(verbatim: bodyText)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Theme.Spacing.s4)
                        .background(Theme.Colors.bgSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    Text("mahnungen.mail.note")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("mahnungen.mail.eyebrow"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Text("mahnungen.mail.close")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.brandInk)
                    }
                    .accessibilityLabel(Text("mahnungen.mail.close"))
                }
            }
        }
    }

    // MARK: - Stufen-Auswahl

    private var stagePicker: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("mahnungen.mail.stageLabel")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(1...3, id: \.self) { value in
                    stageChip(value)
                }
            }
        }
    }

    private func stageChip(_ value: Int) -> some View {
        let active = value == stage
        let label: LocalizedStringKey = switch value {
        case 1: "mahnungen.mail.step1"
        case 2: "mahnungen.mail.step2"
        default: "mahnungen.mail.step3"
        }
        return Button {
            withAnimation(.easeOut(duration: Theme.Motion.fast)) { stage = value }
        } label: {
            Text(label)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(active ? Theme.Colors.brandInk : Theme.Colors.inkSoft)
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s2)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .background(active ? Theme.Colors.brandSoft : Theme.Colors.bgSunken)
                .clipShape(Capsule())
                .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    private func fieldRow(_ label: LocalizedStringKey, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s3) {
            Text(label)
                .font(Theme.Fonts.caption.weight(.bold))
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(width: 56, alignment: .leading)
            Text(verbatim: value)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, Theme.Spacing.s2)
        .accessibilityElement(children: .combine)
    }
}
