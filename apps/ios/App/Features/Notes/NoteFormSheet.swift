import SwiftUI

/// „Notiz anlegen“ bzw. „Notiz bearbeiten“ als Sheet: Titel (Pflicht) + Text.
/// Die EINE Beere-Primäraktion ist Anlegen/Speichern. Erfolg schließt das
/// Sheet; ein Serverfehler zeigt einen Alert und lässt es offen. Der Hinweis
/// unter dem Textfeld macht die Privatheit unmissverständlich.
struct NoteFormSheet: View {
    @StateObject private var model: NoteFormViewModel
    @Environment(\.dismiss) private var dismiss

    init(mode: NoteFormViewModel.Mode, api: APIClient, onSaved: @escaping (Note) -> Void) {
        _model = StateObject(wrappedValue: NoteFormViewModel(mode: mode, api: api, onSaved: onSaved))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(
                                eyebrow: model.isEdit ? "notizen.form.edit.eyebrow" : "notizen.form.create.eyebrow",
                                title: model.isEdit ? "notizen.form.edit.title" : "notizen.form.create.title"
                            )
                            titleField
                            bodyField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text(model.isEdit ? "notizen.form.edit.title" : "notizen.form.create.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("notizen.form.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("notizen.error.title", isPresented: submitErrorBinding) {
                Button("notizen.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: model.submitError ?? "")
            }
#if DEBUG
            .task {
                // NUR DEBUG/Smoke-Test: `-devAutoSubmitNote YES` fährt nach kurzer
                // Renderpause denselben echten Speichern-Pfad wie der Button und
                // schließt bei Erfolg. Löschen wird bewusst NIE automatisiert.
                guard UserDefaults.standard.bool(forKey: "devAutoSubmitNote") else { return }
                try? await _Concurrency.Task.sleep(nanoseconds: 600_000_000)
                if await model.submit() { dismiss() }
            }
#endif
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

    private var titleField: some View {
        fieldGroup(label: "notizen.form.field.title", error: model.titleError) {
            TextField("notizen.form.field.title.placeholder", text: $model.title)
                .textInputAutocapitalization(.sentences)
                .modifier(NoteFieldChrome())
                .onChange(of: model.title) { model.titleError = nil }
                .accessibilityLabel(Text("notizen.form.field.title"))
        }
    }

    private var bodyField: some View {
        fieldGroup(label: "notizen.form.field.body", error: nil) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                TextField("notizen.form.field.body.placeholder", text: $model.body, axis: .vertical)
                    .lineLimit(4...12)
                    .modifier(NoteFieldChrome())
                    .accessibilityLabel(Text("notizen.form.field.body"))
                Text("notizen.form.field.body.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private var submitButton: some View {
        RSMPrimaryButton(
            title: model.isEdit ? "notizen.form.edit.submit" : "notizen.form.create.submit",
            isLoading: model.isSaving
        ) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
    }

    // MARK: - Feld-Gerüst (Label · Inhalt · optionaler Fehler)

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

/// Einheitliches Eingabefeld-Chrome (feature-eigen): Body-Schrift, Mulden-
/// Fläche, Radius M — bewusst lokal statt Zugriff auf fremde private Helfer.
private struct NoteFieldChrome: ViewModifier {
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
