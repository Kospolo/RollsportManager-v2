import Foundation
import SwiftUI

/// Anlegen ODER Bearbeiten einer Sparte als Sheet: Name, Icon-Auswahl,
/// Farb-Auswahl, „Aktiv"-Schalter, Reihenfolge (Sortierung) und „Eigene
/// Finanzen"-Schalter. Erfolg: die erzeugte/aktualisierte `Sparte` fließt via
/// `onSaved` in die Liste, Sheet schließt; 403 zeigt einen Alert und lässt das
/// Sheet offen. Web-Referenz: sparten/_components/SparteFormSheet.tsx.
struct SparteFormSheet: View {
    @StateObject private var model: SparteFormViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        mode: SparteFormMode,
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Sparte) -> Void
    ) {
        _model = StateObject(wrappedValue: SparteFormViewModel(
            mode: mode, api: api, clubId: clubId, onSaved: onSaved
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                            RSMSectionHeader(eyebrow: model.eyebrowKey, title: model.titleKey)
                            nameField
                            iconField
                            colorField
                            sortField
                            activeToggle
                            ownFinancesToggle
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
                    Button("sparten.form.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("sparten.error.title", isPresented: submitErrorBinding) {
                Button("sparten.error.ok", role: .cancel) {}
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
            Text("sparten.form.name.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField("sparten.form.name.placeholder", text: $model.name)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .modifier(SparteFieldChrome())
                .onChange(of: model.name) { model.nameError = nil }
                .accessibilityLabel(Text("sparten.form.name.label"))
            if let error = model.nameError {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Icon-Auswahl

    private var iconField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("sparten.form.icon.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text("sparten.form.icon.hint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
            let columns = [GridItem(.adaptive(minimum: 48), spacing: Theme.Spacing.s2)]
            LazyVGrid(columns: columns, spacing: Theme.Spacing.s2) {
                ForEach(SparteIconCatalog.options, id: \.key) { option in
                    let selected = model.iconKey == option.key
                    Button {
                        model.iconKey = option.key
                    } label: {
                        Image(systemName: option.symbol)
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(selected ? model.accent : Theme.Colors.inkSoft)
                            .frame(width: 48, height: 48)
                            .background(
                                RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous)
                                    .fill(selected ? model.accent.opacity(0.16) : Theme.Colors.bgSunken)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous)
                                    .strokeBorder(selected ? model.accent : Theme.Colors.line, lineWidth: selected ? 2 : 1)
                            )
                    }
                    .buttonStyle(RSMPressableButtonStyle())
                    .accessibilityLabel(Text(verbatim: option.key))
                    .accessibilityAddTraits(selected ? [.isSelected] : [])
                }
            }
        }
    }

    // MARK: - Farb-Auswahl

    private var colorField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("sparten.form.color.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text("sparten.form.color.hint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
            let columns = [GridItem(.adaptive(minimum: 44), spacing: Theme.Spacing.s3)]
            LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                ForEach(SparteColorCatalog.hexColors, id: \.self) { hex in
                    let selected = model.colorHex.caseInsensitiveCompare(hex) == .orderedSame
                    Button {
                        model.colorHex = hex
                    } label: {
                        Circle()
                            .fill(Color(hex: hex) ?? Theme.Colors.brand)
                            .frame(width: 36, height: 36)
                            .overlay(
                                Image(systemName: "checkmark")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundStyle(.white)
                                    .opacity(selected ? 1 : 0)
                            )
                            .overlay(
                                Circle().strokeBorder(Theme.Colors.bgSurface, lineWidth: selected ? 2 : 0)
                            )
                            .padding(2)
                            .overlay(
                                Circle().strokeBorder(
                                    selected ? (Color(hex: hex) ?? Theme.Colors.brand) : .clear,
                                    lineWidth: 2
                                )
                            )
                    }
                    .buttonStyle(RSMPressableButtonStyle())
                    .accessibilityLabel(Text(verbatim: hex))
                    .accessibilityAddTraits(selected ? [.isSelected] : [])
                }
            }
        }
    }

    // MARK: - Reihenfolge

    private var sortField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("sparten.form.sort.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField("sparten.form.sort.placeholder", text: $model.sortText)
                .keyboardType(.numberPad)
                .modifier(SparteFieldChrome())
                .onChange(of: model.sortText) { model.sortError = nil }
                .accessibilityLabel(Text("sparten.form.sort.label"))
            if let error = model.sortError {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            } else {
                Text("sparten.form.sort.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Schalter

    private var activeToggle: some View {
        Toggle(isOn: $model.active) {
            VStack(alignment: .leading, spacing: 2) {
                Text("sparten.form.active.label")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text("sparten.form.active.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .tint(Theme.Colors.brand)
    }

    private var ownFinancesToggle: some View {
        Toggle(isOn: $model.ownFinances) {
            VStack(alignment: .leading, spacing: 2) {
                Text("sparten.form.ownFinances.label")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text("sparten.form.ownFinances.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .tint(Theme.Colors.brand)
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.bgSunken.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    private var submitButton: some View {
        RSMPrimaryButton(title: model.submitKey, isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
    }
}

/// Einheitliches Eingabefeld-Chrome (identisch zum Teams-Formular).
private struct SparteFieldChrome: ViewModifier {
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

enum SparteFormMode: Equatable {
    case create
    case edit(Sparte)
}

@MainActor
final class SparteFormViewModel: ObservableObject {

    @Published var name: String
    @Published var iconKey: String
    @Published var colorHex: String
    @Published var sortText: String
    @Published var active: Bool
    @Published var ownFinances: Bool
    @Published var nameError: LocalizedStringKey?
    @Published var sortError: LocalizedStringKey?
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    private let mode: SparteFormMode
    private let api: APIClient
    private let clubId: String
    private let onSaved: (Sparte) -> Void

    init(mode: SparteFormMode, api: APIClient, clubId: String, onSaved: @escaping (Sparte) -> Void) {
        self.mode = mode
        self.api = api
        self.clubId = clubId
        self.onSaved = onSaved
        switch mode {
        case .create:
            self.name = ""
            self.iconKey = SparteIconCatalog.defaultKey
            self.colorHex = SparteColorCatalog.defaultHex
            self.sortText = ""
            self.active = true
            self.ownFinances = false
        case .edit(let sparte):
            self.name = sparte.name
            self.iconKey = sparte.icon ?? SparteIconCatalog.defaultKey
            self.colorHex = sparte.farbe ?? SparteColorCatalog.defaultHex
            self.sortText = String(sparte.sortierung)
            self.active = sparte.aktiv
            self.ownFinances = sparte.eigeneFinanzen
        }
    }

    var accent: Color { SparteColorCatalog.color(for: colorHex) }

    var isEdit: Bool { if case .edit = mode { return true } else { return false } }
    var eyebrowKey: LocalizedStringKey { isEdit ? "sparten.form.edit.eyebrow" : "sparten.form.create.eyebrow" }
    var titleKey: LocalizedStringKey { isEdit ? "sparten.form.edit.title" : "sparten.form.create.title" }
    var submitKey: LocalizedStringKey { isEdit ? "sparten.form.edit.submit" : "sparten.form.create.submit" }

    /// Reihenfolge parsen: leer ⇒ 0 (Standard); ganze Zahl ≥ 0 ⇒ Wert; sonst nil (Fehler).
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
            nameError = "sparten.form.name.error"
            ok = false
        }
        guard let sortOuter = parsedSort() else {
            sortError = "sparten.form.sort.error"
            return false
        }
        guard ok else { return false }
        // leer ⇒ 0 (Standard-Sortierung)
        let sortValue = sortOuter ?? 0

        isSaving = true
        defer { isSaving = false }
        do {
            let result: Sparte
            switch mode {
            case .create:
                result = try await api.createSparte(
                    clubId: clubId,
                    SparteCreate(
                        name: trimmedName,
                        icon: iconKey,
                        farbe: colorHex,
                        aktiv: active,
                        sortierung: sortValue,
                        eigeneFinanzen: ownFinances
                    )
                )
            case .edit(let sparte):
                result = try await api.updateSparte(
                    clubId: clubId,
                    sparteId: sparte.id,
                    SparteUpdate(
                        name: trimmedName,
                        icon: iconKey,
                        farbe: colorHex,
                        aktiv: active,
                        sortierung: sortValue,
                        eigeneFinanzen: ownFinances
                    )
                )
            }
            onSaved(result)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("sparten.error.forbidden", comment: "403 beim Speichern")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}
