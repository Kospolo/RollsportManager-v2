import SwiftUI

/// Zahlweg-Optionen der Rechnungs-Zahlung. Der Wert wird als Klartext
/// (lokalisiert) im Feld `paid_via` gespeichert — die Anzeige ist lokalisiert.
enum InvoicePayVia: String, CaseIterable, Identifiable {
    case sepa
    case transfer
    case cash
    case paypal
    case other

    var id: Self { self }

    var labelKey: LocalizedStringKey {
        switch self {
        case .sepa: "rechnungen.via.sepa"
        case .transfer: "rechnungen.via.transfer"
        case .cash: "rechnungen.via.cash"
        case .paypal: "rechnungen.via.paypal"
        case .other: "rechnungen.via.other"
        }
    }

    /// Der als `paid_via` gespeicherte Klartext (lokalisiert, wie im Web).
    var storedText: String {
        switch self {
        case .sepa: String(localized: "rechnungen.via.sepa")
        case .transfer: String(localized: "rechnungen.via.transfer")
        case .cash: String(localized: "rechnungen.via.cash")
        case .paypal: String(localized: "rechnungen.via.paypal")
        case .other: String(localized: "rechnungen.via.other")
        }
    }
}

/// „Als bezahlt"-Panel: Zahlweg wählen und optional als Einnahme ins
/// Kassenbuch buchen (mit Kategorie). Erscheint erst nach „Als bezahlt
/// markieren" — die eigentliche Buchung bestätigt der Button „Bezahlt buchen".
struct InvoiceSettlePanel: View {
    @Binding var via: InvoicePayVia
    @Binding var postToLedger: Bool
    @Binding var categoryId: String
    let categories: [LedgerCategory]

    private var selectedCategoryName: String? {
        categories.first { $0.id == categoryId }?.name
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text("rechnungen.settle.title")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)

            labeled("rechnungen.settle.via") {
                Menu {
                    ForEach(InvoicePayVia.allCases) { option in
                        Button { via = option } label: { Text(option.labelKey) }
                    }
                } label: {
                    menuLabel(Text(via.labelKey))
                }
                .accessibilityLabel(Text("rechnungen.settle.via"))
            }

            Toggle(isOn: $postToLedger) {
                Text("rechnungen.settle.post")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            .tint(Theme.Colors.brand)

            if postToLedger {
                labeled("rechnungen.settle.category") {
                    Menu {
                        Button { categoryId = "" } label: { Text("rechnungen.settle.category.none") }
                        ForEach(categories, id: \.id) { category in
                            Button { categoryId = category.id } label: {
                                Text(verbatim: category.name)
                            }
                        }
                    } label: {
                        menuLabel(selectedCategoryName.map { Text(verbatim: $0) }
                            ?? Text("rechnungen.settle.category.none"))
                    }
                    .accessibilityLabel(Text("rechnungen.settle.category"))
                }
            }
        }
        .padding(Theme.Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }

    private func labeled(
        _ label: LocalizedStringKey,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(label)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
            content()
        }
    }

    private func menuLabel(_ text: Text) -> some View {
        HStack {
            text
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Spacer(minLength: Theme.Spacing.s2)
            Image(systemName: "chevron.up.chevron.down")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .padding(Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.touchTarget)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}
