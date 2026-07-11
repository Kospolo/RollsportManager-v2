import SwiftUI

/// „Buchung erfassen“-Sheet: Datum, Kategorie (aus `listLedgerCategories`), Art
/// (Einnahme/Ausgabe → Vorzeichen), Betrag, Zweck und Gegenpartei (Mitglied
/// ODER Organisation). Schreibt über `createLedgerEntry` (GoBD-Append,
/// `amountCents` vorzeichenbehaftet). Erfolg → schließen; 403/Fehler →
/// Klartext-Hinweis, das Sheet bleibt offen.
struct CashbookBookingSheet: View {
    let categories: [LedgerCategory]
    let members: [ClubMember]
    let clubId: String
    /// Legt die Buchung an (reloadet die Liste); wirft bei Fehlern.
    let submit: (LedgerEntryCreate) async throws -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var date = Date()
    @State private var categoryId: String?
    @State private var direction: LedgerCategoryKind = .expense
    @State private var amountText = ""
    @State private var purpose = ""
    @State private var cpKind: CounterpartyKind = .person
    @State private var memberId: String?
    @State private var orgName = ""

    @State private var dateError = false
    @State private var categoryError = false
    @State private var amountError = false
    @State private var purposeError = false
    @State private var memberError = false
    @State private var orgError = false
    @State private var submitError: String?
    @State private var submitting = false

    private let maxDate = Date()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                    dateField
                    categoryField
                    directionField
                    amountField
                    purposeField
                    counterpartyField
                    if cpKind == .person { memberField } else { orgField }
                    if let submitError {
                        submitBanner(submitError)
                    }
                    Text("kassenbuch.sheet.gobd")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("kassenbuch.sheet.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("kassenbuch.cancel") { dismiss() }
                        .disabled(submitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("kassenbuch.create") { save() }
                        .disabled(submitting)
                        .fontWeight(.bold)
                }
            }
        }
    }

    // MARK: - Felder

    private var dateField: some View {
        LabeledField(label: "kassenbuch.f.date", error: dateError ? "kassenbuch.err.date" : nil) {
            DatePicker(
                "kassenbuch.f.date",
                selection: $date,
                in: ...maxDate,
                displayedComponents: .date
            )
            .labelsHidden()
            .tint(Theme.Colors.brand)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var categoryField: some View {
        LabeledField(label: "kassenbuch.f.category", error: categoryError ? "kassenbuch.err.category" : nil) {
            Picker(selection: $categoryId) {
                Text("kassenbuch.f.categoryPlaceholder").tag(String?.none)
                ForEach(categories, id: \.id) { category in
                    (Text(verbatim: category.name + "  ·  ")
                        + Text(category.kind == .income ? "kassenbuch.income" : "kassenbuch.expense"))
                        .tag(Optional(category.id))
                }
            } label: {
                Text("kassenbuch.f.category")
            }
            .pickerStyle(.menu)
            .tint(Theme.Colors.brand)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fieldChrome()
            .onChange(of: categoryId) { _, newValue in
                categoryError = false
                if let id = newValue, let cat = categories.first(where: { $0.id == id }) {
                    direction = cat.kind
                }
            }
        }
    }

    private var directionField: some View {
        LabeledField(label: "kassenbuch.f.direction", error: nil) {
            HStack(spacing: Theme.Spacing.s2) {
                CashbookChip(label: "kassenbuch.income", isActive: direction == .income) {
                    direction = .income
                }
                CashbookChip(label: "kassenbuch.expense", isActive: direction == .expense) {
                    direction = .expense
                }
            }
        }
    }

    private var amountField: some View {
        LabeledField(
            label: "kassenbuch.f.amount",
            error: amountError ? "kassenbuch.err.amount" : nil,
            hint: "kassenbuch.f.amountHint"
        ) {
            TextField("0,00", text: $amountText)
                .keyboardType(.decimalPad)
                .font(Theme.Fonts.monoTable)
                .monospacedDigit()
                .fieldChrome()
                .onChange(of: amountText) { _, _ in amountError = false }
        }
    }

    private var purposeField: some View {
        LabeledField(label: "kassenbuch.f.purpose", error: purposeError ? "kassenbuch.err.purpose" : nil) {
            TextField("kassenbuch.f.purposePlaceholder", text: $purpose, axis: .vertical)
                .lineLimit(2...4)
                .font(Theme.Fonts.body)
                .fieldChrome()
                .onChange(of: purpose) { _, _ in purposeError = false }
        }
    }

    private var counterpartyField: some View {
        LabeledField(label: "kassenbuch.f.counterparty", error: nil) {
            HStack(spacing: Theme.Spacing.s2) {
                CashbookChip(label: "kassenbuch.cp.person", isActive: cpKind == .person) {
                    cpKind = .person
                }
                CashbookChip(label: "kassenbuch.cp.org", isActive: cpKind == .org) {
                    cpKind = .org
                }
            }
        }
    }

    private var memberField: some View {
        LabeledField(label: "kassenbuch.f.member", error: memberError ? "kassenbuch.err.member" : nil) {
            Picker(selection: $memberId) {
                Text("kassenbuch.f.memberPlaceholder").tag(String?.none)
                ForEach(members, id: \.id) { member in
                    Text(verbatim: "\(member.firstName) \(member.lastName)")
                        .tag(Optional(member.id))
                }
            } label: {
                Text("kassenbuch.f.member")
            }
            .pickerStyle(.menu)
            .tint(Theme.Colors.brand)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fieldChrome()
            .onChange(of: memberId) { _, _ in memberError = false }
        }
    }

    private var orgField: some View {
        LabeledField(label: "kassenbuch.f.orgName", error: orgError ? "kassenbuch.err.org" : nil) {
            TextField("kassenbuch.f.orgNamePlaceholder", text: $orgName)
                .font(Theme.Fonts.body)
                .fieldChrome()
                .onChange(of: orgName) { _, _ in orgError = false }
        }
    }

    private func submitBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.danger)
                .accessibilityHidden(true)
            Text(verbatim: message)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.danger)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.dangerSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Speichern

    private func save() {
        guard !submitting else { return }
        submitError = nil
        let cents = CashbookInput.parseAmountCents(amountText)
        let trimmedPurpose = purpose.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedOrg = orgName.trimmingCharacters(in: .whitespacesAndNewlines)

        dateError = date > maxDate
        categoryError = categoryId == nil
        amountError = cents == nil
        purposeError = trimmedPurpose.isEmpty
        memberError = cpKind == .person && memberId == nil
        orgError = cpKind == .org && trimmedOrg.isEmpty

        guard !dateError, !categoryError, !amountError, !purposeError, !memberError, !orgError,
              let cents, let categoryId else { return }

        let signed = direction == .income ? cents : -cents
        let categoryName = categories.first(where: { $0.id == categoryId })?.name
        let input = LedgerEntryCreate(
            clubId: clubId,
            entryOn: CashbookDerive.isoDate(date),
            description: trimmedPurpose,
            counterpartyKind: cpKind,
            counterpartyMemberId: cpKind == .person ? memberId : nil,
            counterpartyName: cpKind == .org ? trimmedOrg : nil,
            amountCents: signed,
            category: categoryName,
            categoryId: categoryId
        )

        submitting = true
        _Concurrency.Task {
            do {
                try await submit(input)
                submitting = false
                dismiss()
            } catch {
                submitting = false
                submitError = error.isForbiddenAPIError
                    ? String(localized: "kassenbuch.forbidden")
                    : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }
}

/// Feld-Rahmen mit Label über der Eingabe und optionalem Fehler/Hinweis darunter.
private struct LabeledField<Content: View>: View {
    let label: LocalizedStringKey
    var error: LocalizedStringKey?
    var hint: LocalizedStringKey?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(label)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            content()
            if let error {
                Text(error)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.danger)
            } else if let hint {
                Text(hint)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
    }
}

/// Einheitliche Mulden-Optik für Eingaben (bgSunken, Radius M, Hairline).
private extension View {
    func fieldChrome() -> some View {
        self
            .padding(.horizontal, Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                    .stroke(Theme.Colors.line, lineWidth: 1)
            )
    }
}
