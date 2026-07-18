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
        sparten: [Sparte] = [],
        onSaved: @escaping (Team) -> Void
    ) {
        _model = StateObject(wrappedValue: TeamFormViewModel(
            mode: mode, api: api, clubId: clubId, sparten: sparten, onSaved: onSaved
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
                            if !model.sparten.isEmpty { sparteField }
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
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Sparten-Zuordnung (Einfachauswahl inkl. „Keine Sparte"). Nur sichtbar,
    /// wenn Sparten übergeben wurden — der Aufrufer übergibt sie nur bei
    /// can_manage_sparten, sonst bleibt die Auswahl bewusst ausgeblendet.
    private var sparteField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("teams.form.sparte.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Menu {
                Button {
                    model.selectedSparteId = nil
                } label: {
                    if model.selectedSparteId == nil {
                        Label("teams.form.sparte.none", systemImage: "checkmark")
                    } else {
                        Text("teams.form.sparte.none")
                    }
                }
                ForEach(model.sparten, id: \.id) { sparte in
                    Button {
                        model.selectedSparteId = sparte.id
                    } label: {
                        if model.selectedSparteId == sparte.id {
                            Label(sparte.name, systemImage: "checkmark")
                        } else {
                            Text(verbatim: sparte.name)
                        }
                    }
                }
            } label: {
                HStack(spacing: Theme.Spacing.s2) {
                    if let selected = model.selectedSparte {
                        Image(systemName: SparteIconCatalog.symbol(for: selected.icon))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(SparteColorCatalog.color(for: selected.farbe))
                        Text(verbatim: selected.name)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                    } else {
                        Text("teams.form.sparte.none")
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                .font(Theme.Fonts.body)
                .modifier(TeamFieldChrome())
            }
            .accessibilityLabel(Text("teams.form.sparte.label"))
            Text("teams.form.sparte.hint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
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
    /// Ausgewählte Sparte (nil = „Keine Sparte"). Nur relevant, wenn `sparten`
    /// nicht leer ist (Aufrufer übergibt sie nur bei can_manage_sparten).
    @Published var selectedSparteId: String?
    @Published var nameError: LocalizedStringKey?
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    /// Verfügbare Sparten für die Zuordnung (leer ⇒ Auswahl ausgeblendet).
    let sparten: [Sparte]

    private let mode: TeamFormMode
    private let api: APIClient
    private let clubId: String
    private let onSaved: (Team) -> Void
    /// Ursprüngliche Sparte-Zuordnung — zum Erkennen einer Änderung beim Speichern.
    private let originalSparteId: String?

    init(mode: TeamFormMode, api: APIClient, clubId: String, sparten: [Sparte] = [], onSaved: @escaping (Team) -> Void) {
        self.mode = mode
        self.api = api
        self.clubId = clubId
        self.sparten = sparten
        self.onSaved = onSaved
        switch mode {
        case .create:
            self.name = ""
            self.ageGroup = ""
            self.selectedSparteId = nil
            self.originalSparteId = nil
        case .edit(let team):
            self.name = team.name
            self.ageGroup = team.ageGroup ?? ""
            self.selectedSparteId = team.sparteId
            self.originalSparteId = team.sparteId
        }
    }

    /// Aufgelöste Auswahl (für das Menu-Label).
    var selectedSparte: Sparte? {
        guard let id = selectedSparteId else { return nil }
        return sparten.first { $0.id == id }
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
            var result: Team
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
            // Team → Sparte als separater Call (eigener Endpoint, eigenes Recht
            // can_manage_sparten). Nur anfassen, wenn sich die Zuordnung geändert
            // hat (bei „create" ist die Ausgangslage „keine Sparte").
            if selectedSparteId != originalSparteId {
                result = try await api.setTeamSparte(
                    clubId: clubId,
                    teamId: result.id,
                    TeamSparteSet(sparteId: selectedSparteId)
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
