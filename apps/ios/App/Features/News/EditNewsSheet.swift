import SwiftUI

/// „Nachricht bearbeiten“ als Sheet: Spiegel von `NewNewsSheet` — dieselben
/// Felder (Titel · Text · Oben-anpinnen), nur aus einer bestehenden `News`
/// vorbelegt und per PATCH gespeichert. Die EINE Beere ist „Änderungen
/// speichern“. Erfolg schließt das Sheet; 403 zeigt einen Alert und lässt es
/// offen. Web-Referenz: news/_components/NewsFormSheet.tsx (editing != null).
struct EditNewsSheet: View {
    @StateObject private var model: EditNewsViewModel
    @Environment(\.dismiss) private var dismiss

    init(api: APIClient, news: News, onSaved: @escaping (News) -> Void) {
        _model = StateObject(wrappedValue: EditNewsViewModel(
            api: api,
            news: news,
            onSaved: onSaved
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(eyebrow: "Bearbeiten", title: "Nachricht bearbeiten")
                            titleField
                            bodyField
                            pinField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text(verbatim: "Nachricht bearbeiten"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("news.form.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("news.error.title", isPresented: submitErrorBinding) {
                Button("news.error.ok", role: .cancel) {}
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

    private var titleField: some View {
        fieldGroup(label: "news.form.field.title", error: model.fieldErrors.title) {
            TextField("news.form.field.title.placeholder", text: $model.title)
                .textInputAutocapitalization(.sentences)
                .modifier(EditNewsFieldChrome())
                .onChange(of: model.title) { model.fieldErrors.title = nil }
                .accessibilityLabel(Text("news.form.field.title"))
        }
    }

    private var bodyField: some View {
        fieldGroup(label: "news.form.field.body", error: model.fieldErrors.body) {
            TextField("news.form.field.body.placeholder", text: $model.body, axis: .vertical)
                .textInputAutocapitalization(.sentences)
                .lineLimit(6...12)
                .modifier(EditNewsFieldChrome())
                .onChange(of: model.body) { model.fieldErrors.body = nil }
                .accessibilityLabel(Text("news.form.field.body"))
        }
    }

    private var pinField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Toggle(isOn: $model.isPinned) {
                Text("news.form.pin")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            .tint(Theme.Colors.brand)
            Text("news.form.pinHint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
    }

    private var submitButton: some View {
        RSMPrimaryButton(title: "Änderungen speichern", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
        .accessibilityLabel(Text(verbatim: "Änderungen speichern"))
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

/// Einheitliches Eingabefeld-Chrome: Body-Schrift, Mulden-Fläche, Radius M.
/// (Spiegel von `NewsFieldChrome`, lokal gehalten, damit die Sheets unabhängig
/// bleiben.)
private struct EditNewsFieldChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Theme.Fonts.body)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .topLeading)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}
