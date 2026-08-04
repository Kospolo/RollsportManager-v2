import Foundation
import SwiftUI

/// Anlegen ODER Bearbeiten einer Abteilung als Sheet: Name, Beschreibung,
/// Leitung (optional) und Reihenfolge. Erfolg: die erzeugte/aktualisierte
/// `Department` fließt via `onSaved` in die Liste, Sheet schließt; 403 zeigt
/// einen Alert und lässt das Sheet offen.
/// Web-Referenz: abteilungen/_components/DepartmentFormDialog.tsx.
struct DepartmentFormSheet: View {
    @StateObject private var model: DepartmentFormViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        mode: DepartmentFormMode,
        members: [ClubMember],
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Department) -> Void
    ) {
        _model = StateObject(wrappedValue: DepartmentFormViewModel(
            mode: mode, members: members, api: api, clubId: clubId, onSaved: onSaved
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                            RSMSectionHeader(
                                eyebrow: model.isEdit ? "Abteilung" : "Neu",
                                title: model.isEdit ? "Abteilung bearbeiten" : "Abteilung anlegen"
                            )
                            nameField
                            descriptionField
                            leadField
                            sortField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text(verbatim: model.isEdit ? "Abteilung bearbeiten" : "Abteilung anlegen"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Text(verbatim: "Abbrechen")
                    }
                    .tint(Theme.Colors.inkSoft)
                }
            }
            .alert(Text(verbatim: "Speichern fehlgeschlagen"), isPresented: submitErrorBinding) {
                Button(role: .cancel) { } label: { Text(verbatim: "OK") }
            } message: {
                Text(verbatim: model.submitError ?? "")
            }
        }
        .presentationDragIndicator(.visible)
    }

    private var submitErrorBinding: Binding<Bool> {
        Binding(
            get: { model.submitError != nil },
            set: { if !$0 { model.submitError = nil } }
        )
    }

    // MARK: - Name

    private var nameField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: "Name")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField(text: $model.name) {
                Text(verbatim: "z. B. Rollkunstlauf")
            }
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled()
            .modifier(DepartmentFieldChrome())
            .onChange(of: model.name) { model.nameError = nil }
            .accessibilityLabel(Text(verbatim: "Name"))
            if let error = model.nameError {
                Text(verbatim: error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Beschreibung

    private var descriptionField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: "Beschreibung")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField(text: $model.description, axis: .vertical) {
                Text(verbatim: "Optionale Kurzbeschreibung")
            }
            .lineLimit(3...6)
            .modifier(DepartmentFieldChrome())
            .accessibilityLabel(Text(verbatim: "Beschreibung"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Leitung

    private var leadField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: "Leitung")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Menu {
                Button {
                    model.leadMemberId = ""
                } label: {
                    Text(verbatim: "— keine —")
                }
                ForEach(model.sortedMembers, id: \.id) { member in
                    Button {
                        model.leadMemberId = member.id
                    } label: {
                        Text(verbatim: member.departmentsDisplayName)
                    }
                }
            } label: {
                HStack(spacing: Theme.Spacing.s2) {
                    Text(verbatim: model.leadLabel)
                        .foregroundStyle(model.leadMemberId.isEmpty ? Theme.Colors.inkSoft : Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    Spacer(minLength: Theme.Spacing.s2)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                .font(Theme.Fonts.body)
                .padding(Theme.Spacing.s3)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            }
            .accessibilityLabel(Text(verbatim: "Leitung"))
            Text(verbatim: "Wer diese Abteilung leitet (optional).")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Reihenfolge

    private var sortField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: "Reihenfolge")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField(text: $model.sortText) {
                Text(verbatim: "0")
            }
            .keyboardType(.numberPad)
            .modifier(DepartmentFieldChrome())
            .onChange(of: model.sortText) { model.sortError = nil }
            .accessibilityLabel(Text(verbatim: "Reihenfolge"))
            if let error = model.sortError {
                Text(verbatim: error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            } else {
                Text(verbatim: "Ganze Zahl ab 0 — kleinere zuerst.")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var submitButton: some View {
        RSMPrimaryButton(
            title: model.isEdit ? "Speichern" : "Anlegen",
            isLoading: model.isSaving
        ) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
    }
}

/// Einheitliches Eingabefeld-Chrome (analog zum Sparten-/Teams-Formular).
private struct DepartmentFieldChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Theme.Fonts.body)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}

// MARK: - Modus + ViewModel

enum DepartmentFormMode: Equatable {
    case create
    case edit(Department)
}

@MainActor
final class DepartmentFormViewModel: ObservableObject {

    @Published var name: String
    @Published var description: String
    /// Leere ID = „keine Leitung“.
    @Published var leadMemberId: String
    @Published var sortText: String
    @Published var nameError: String?
    @Published var sortError: String?
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    let sortedMembers: [ClubMember]
    private let mode: DepartmentFormMode
    private let api: APIClient
    private let clubId: String
    private let onSaved: (Department) -> Void

    init(
        mode: DepartmentFormMode,
        members: [ClubMember],
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Department) -> Void
    ) {
        self.mode = mode
        self.api = api
        self.clubId = clubId
        self.onSaved = onSaved
        self.sortedMembers = members.sorted { a, b in
            let byLast = a.lastName.localizedCaseInsensitiveCompare(b.lastName)
            if byLast != .orderedSame { return byLast == .orderedAscending }
            return a.firstName.localizedCaseInsensitiveCompare(b.firstName) == .orderedAscending
        }
        switch mode {
        case .create:
            self.name = ""
            self.description = ""
            self.leadMemberId = ""
            self.sortText = ""
        case .edit(let department):
            self.name = department.name
            self.description = department.description ?? ""
            self.leadMemberId = department.leadMemberId ?? ""
            self.sortText = String(department.sortOrder)
        }
    }

    var isEdit: Bool { if case .edit = mode { return true } else { return false } }

    /// Anzeige-Text des Leitungs-Menüs: Name der gewählten Person oder Platzhalter.
    var leadLabel: String {
        guard !leadMemberId.isEmpty,
              let member = sortedMembers.first(where: { $0.id == leadMemberId })
        else { return "— keine —" }
        return member.departmentsDisplayName
    }

    /// Reihenfolge parsen: leer ⇒ .some(nil) (Standard/unverändert); ganze Zahl
    /// ≥ 0 ⇒ .some(wert); sonst nil (Fehler).
    private func parsedSort() -> Int?? {
        let trimmed = sortText.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .some(nil) }
        guard let value = Int(trimmed), value >= 0 else { return nil }
        return .some(value)
    }

    /// Validiert und speichert. Erfolg → `true` (Sheet schließt); Validierungs-
    /// oder 403-Fehler → `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var ok = true
        if trimmedName.isEmpty {
            nameError = "Bitte einen Namen eingeben."
            ok = false
        }
        guard let sortOuter = parsedSort() else {
            sortError = "Bitte eine ganze Zahl ab 0 eingeben."
            return false
        }
        guard ok else { return false }

        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let lead = leadMemberId.isEmpty ? nil : leadMemberId

        isSaving = true
        defer { isSaving = false }
        do {
            let result: Department
            switch mode {
            case .create:
                result = try await api.createDepartment(
                    DepartmentCreate(
                        clubId: clubId,
                        name: trimmedName,
                        description: trimmedDescription.isEmpty ? nil : trimmedDescription,
                        leadMemberId: lead,
                        sortOrder: sortOuter
                    )
                )
            case .edit(let department):
                result = try await api.updateDepartment(
                    departmentId: department.id,
                    // Beschreibung wird immer mitgeschickt (leer = geleert);
                    // Reihenfolge nur, wenn eine Zahl eingegeben wurde.
                    DepartmentUpdate(
                        name: trimmedName,
                        description: trimmedDescription,
                        leadMemberId: lead,
                        sortOrder: sortOuter
                    )
                )
            }
            onSaved(result)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? "Dazu fehlt dir die Berechtigung."
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}
