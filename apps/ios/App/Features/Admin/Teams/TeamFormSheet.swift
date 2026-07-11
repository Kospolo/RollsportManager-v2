import Foundation
import SwiftUI

/// Anlegen ODER Umbenennen eines Teams (Name + optionale Altersklasse) als
/// Sheet. Die EINE Beere ist „Team anlegen“ bzw. „Speichern“. Erfolg: das
/// erzeugte/aktualisierte `Team` fließt via `onSaved` in die Liste, Sheet
/// schließt; 403 zeigt einen Alert und lässt das Sheet offen.
/// Web-Referenz: teams/TeamFormDialog.tsx.
struct TeamFormSheet: View {
    @StateObject private var model: TeamFormViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        mode: TeamFormMode,
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Team) -> Void
    ) {
        _model = StateObject(wrappedValue: TeamFormViewModel(
            mode: mode, api: api, clubId: clubId, onSaved: onSaved
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(eyebrow: model.eyebrowKey, title: model.titleKey)
                            nameField
                            ageField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(model.titleKey)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("teams.form.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("teams.error.title", isPresented: submitErrorBinding) {
                Button("teams.error.ok", role: .cancel) {}
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

    // MARK: - Felder

    private var nameField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("teams.form.name.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField("teams.form.name.placeholder", text: $model.name)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .modifier(TeamFieldChrome())
                .onChange(of: model.name) { model.nameError = nil }
                .accessibilityLabel(Text("teams.form.name.label"))
            if let error = model.nameError {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var ageField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("teams.form.ageGroup.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField("teams.form.ageGroup.placeholder", text: $model.ageGroup)
                .autocorrectionDisabled()
                .modifier(TeamFieldChrome())
                .accessibilityLabel(Text("teams.form.ageGroup.label"))
            Text("teams.form.ageGroup.hint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var submitButton: some View {
        RSMPrimaryButton(title: model.submitKey, isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
    }
}

/// Einheitliches Eingabefeld-Chrome: Body-Schrift, Mulden-Fläche, Radius M.
private struct TeamFieldChrome: ViewModifier {
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

enum TeamFormMode: Equatable {
    case create
    case edit(Team)
}

@MainActor
final class TeamFormViewModel: ObservableObject {

    @Published var name: String
    @Published var ageGroup: String
    @Published var nameError: LocalizedStringKey?
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    private let mode: TeamFormMode
    private let api: APIClient
    private let clubId: String
    private let onSaved: (Team) -> Void

    init(mode: TeamFormMode, api: APIClient, clubId: String, onSaved: @escaping (Team) -> Void) {
        self.mode = mode
        self.api = api
        self.clubId = clubId
        self.onSaved = onSaved
        switch mode {
        case .create:
            self.name = ""
            self.ageGroup = ""
        case .edit(let team):
            self.name = team.name
            self.ageGroup = team.ageGroup ?? ""
        }
    }

    var isEdit: Bool { if case .edit = mode { return true } else { return false } }
    var eyebrowKey: LocalizedStringKey { isEdit ? "teams.form.edit.eyebrow" : "teams.form.create.eyebrow" }
    var titleKey: LocalizedStringKey { isEdit ? "teams.form.edit.title" : "teams.form.create.title" }
    var submitKey: LocalizedStringKey { isEdit ? "teams.form.edit.submit" : "teams.form.create.submit" }

    /// Validiert und speichert. Erfolg → `true` (Sheet schließt); Validierungs-
    /// oder 403-Fehler → `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            nameError = "teams.form.name.error"
            return false
        }
        let trimmedAge = ageGroup.trimmingCharacters(in: .whitespacesAndNewlines)
        let age: String? = trimmedAge.isEmpty ? nil : trimmedAge

        isSaving = true
        defer { isSaving = false }
        do {
            let result: Team
            switch mode {
            case .create:
                result = try await api.createTeam(clubId: clubId, TeamCreate(name: trimmedName, ageGroup: age))
            case .edit(let team):
                result = try await api.updateTeam(
                    clubId: clubId,
                    teamId: team.id,
                    TeamUpdate(name: trimmedName, ageGroup: age)
                )
            }
            onSaved(result)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("teams.error.forbidden", comment: "403 beim Speichern")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}
