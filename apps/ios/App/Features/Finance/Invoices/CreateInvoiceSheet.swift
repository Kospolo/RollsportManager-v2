import Foundation
import SwiftUI

/// „Rechnung erstellen" als Sheet: Mitglied · Zweck · Betrag · Fälligkeit
/// (optional) · „Sofort offen stellen". Die EINE Beere ist „Rechnung anlegen"
/// (POST /invoices via `createInvoice`). Erfolg schließt das Sheet und meldet
/// die neue Rechnung zurück; 403/Fehler bleiben als Alert stehen, kein Absturz.
///
/// Web-Referenz: rechnungen/_components/CreateInvoiceSheet.tsx.
struct CreateInvoiceSheet: View {
    let api: APIClient
    let clubId: String
    let members: [ClubMember]
    let onCreated: (Invoice) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var memberId = ""
    @State private var title = ""
    @State private var amount = ""
    @State private var hasDueDate = false
    @State private var dueDate = Date()
    @State private var issue = true

    @State private var memberError = false
    @State private var titleError = false
    @State private var amountError = false

    @State private var submitting = false
    @State private var submitError: String?

    private var sortedMembers: [ClubMember] {
        members.sorted { lhs, rhs in
            let last = lhs.lastName.localizedCaseInsensitiveCompare(rhs.lastName)
            if last != .orderedSame { return last == .orderedAscending }
            return lhs.firstName.localizedCaseInsensitiveCompare(rhs.firstName) == .orderedAscending
        }
    }

    private var selectedMemberName: String? {
        members.first { $0.id == memberId }.map { "\($0.firstName) \($0.lastName)" }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(
                                eyebrow: "rechnungen.create.eyebrow",
                                title: "rechnungen.create.title"
                            )
                            memberField
                            titleField
                            amountField
                            dueField
                            issueField
                        }
                    }
                    RSMPrimaryButton(title: "rechnungen.create.submit", isLoading: submitting) {
                        _Concurrency.Task { await submit() }
                    }
                    .accessibilityLabel(Text("rechnungen.create.submit"))
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("rechnungen.create.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("rechnungen.create.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("rechnungen.error.title", isPresented: errorBinding) {
                Button("rechnungen.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: submitError ?? "")
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Felder

    private var memberField: some View {
        fieldGroup(label: "rechnungen.create.member", error: memberError ? "rechnungen.create.member.error" : nil) {
            Menu {
                ForEach(sortedMembers, id: \.id) { member in
                    Button {
                        memberId = member.id
                        memberError = false
                    } label: {
                        Text(verbatim: "\(member.firstName) \(member.lastName)")
                    }
                }
            } label: {
                HStack {
                    (selectedMemberName.map { Text(verbatim: $0) }
                        ?? Text("rechnungen.create.member.placeholder"))
                        .font(Theme.Fonts.body)
                        .foregroundStyle(selectedMemberName == nil
                            ? Theme.Colors.inkFaint : Theme.Colors.inkPrimary)
                    Spacer(minLength: Theme.Spacing.s2)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .padding(Theme.Spacing.s3)
                .frame(minHeight: Theme.Size.touchTarget)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            }
            .accessibilityLabel(Text("rechnungen.create.member"))
        }
    }

    private var titleField: some View {
        fieldGroup(label: "rechnungen.create.purpose", error: titleError ? "rechnungen.create.purpose.error" : nil) {
            TextField("rechnungen.create.purpose.placeholder", text: $title)
                .textInputAutocapitalization(.sentences)
                .modifier(InvoiceFieldChrome())
                .onChange(of: title) { titleError = false }
                .accessibilityLabel(Text("rechnungen.create.purpose"))
        }
    }

    private var amountField: some View {
        fieldGroup(label: "rechnungen.create.amount", error: amountError ? "rechnungen.create.amount.error" : nil) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                TextField("rechnungen.create.amount.placeholder", text: $amount)
                    .keyboardType(.decimalPad)
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .padding(Theme.Spacing.s3)
                    .frame(minHeight: Theme.Size.touchTarget, alignment: .leading)
                    .background(Theme.Colors.bgSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    .onChange(of: amount) { amountError = false }
                    .accessibilityLabel(Text("rechnungen.create.amount"))
                Text("rechnungen.create.amount.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private var dueField: some View {
        fieldGroup(label: "rechnungen.create.due", error: nil) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Toggle(isOn: $hasDueDate) {
                    Text("rechnungen.create.due.toggle")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                }
                .tint(Theme.Colors.brand)
                if hasDueDate {
                    DatePicker(
                        "rechnungen.create.due",
                        selection: $dueDate,
                        displayedComponents: [.date]
                    )
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .tint(Theme.Colors.brand)
                } else {
                    Text("rechnungen.create.due.hint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
    }

    private var issueField: some View {
        fieldGroup(label: "rechnungen.create.issue", error: nil) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Toggle(isOn: $issue) {
                    Text(issue ? "rechnungen.create.issue.on" : "rechnungen.create.issue.off")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                }
                .tint(Theme.Colors.brand)
                Text("rechnungen.create.issue.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    // MARK: - Anlegen

    private func submit() async {
        guard !submitting else { return }
        let cents = InvoiceAmountInput.parseEuroToCents(amount)
        memberError = memberId.isEmpty
        titleError = title.trimmingCharacters(in: .whitespaces).isEmpty
        amountError = (cents ?? 0) <= 0
        guard !memberError, !titleError, !amountError, let cents else { return }

        submitting = true
        defer { submitting = false }
        let input = InvoiceCreate(
            clubId: clubId,
            memberId: memberId,
            title: title.trimmingCharacters(in: .whitespaces),
            amountCents: cents,
            dueOn: hasDueDate ? Self.dateFormatter.string(from: dueDate) : nil,
            issue: issue
        )
        do {
            let invoice = try await api.createInvoice(input)
            onCreated(invoice)
            dismiss()
        } catch {
            submitError = error.isForbiddenAPIError
                ? String(localized: "rechnungen.forbidden.message")
                : (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { submitError != nil }, set: { if !$0 { submitError = nil } })
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    // MARK: - Feld-Gerüst

    private func fieldGroup(
        label: LocalizedStringKey,
        error: LocalizedStringKey?,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(label)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            content()
            if let error {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Einheitliches Eingabefeld-Chrome (Body-Schrift, Mulden-Fläche, Radius M).
private struct InvoiceFieldChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Theme.Fonts.body)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .padding(Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.touchTarget, alignment: .topLeading)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}
