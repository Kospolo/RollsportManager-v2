import SwiftUI

/// „Stunden erfassen“ als Sheet: Datum · Stunden · Art · Notiz. Die EINE Beere
/// ist „Erfassen“. Erfolg schließt das Sheet; 403 zeigt einen Alert und lässt
/// es offen. Selbst-Service: der Eintrag läuft fest auf das eigene Mitglied.
/// Web-Referenz: pflichtstunden/_components/LogHoursSheet.tsx.
struct LogHoursSheet: View {
    @StateObject private var model: LogHoursViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        api: APIClient,
        clubId: String,
        memberId: String,
        onCreated: @escaping (DutyEntry) -> Void
    ) {
        _model = StateObject(wrappedValue: LogHoursViewModel(
            api: api,
            clubId: clubId,
            memberId: memberId,
            onCreated: onCreated
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(
                                eyebrow: "pflichtstunden.sheet.eyebrow",
                                title: "pflichtstunden.sheet.title"
                            )
                            dateField
                            hoursField
                            kindField
                            noteField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("pflichtstunden.sheet.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("pflichtstunden.sheet.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("pflichtstunden.sheet.error.title", isPresented: submitErrorBinding) {
                Button("pflichtstunden.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: model.submitError ?? "")
            }
#if DEBUG
            .task {
                // NUR DEBUG/Smoke-Test: `-devAutoSubmitDutyHours YES` fährt nach
                // kurzer Renderpause denselben echten Erfassen-Pfad wie der
                // „Erfassen“-Button (POST /duty-entries) und schließt bei Erfolg.
                guard UserDefaults.standard.bool(forKey: "devAutoSubmitDutyHours") else { return }
                if model.hoursText.isEmpty { model.hoursText = "2" }
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

    private var dateField: some View {
        fieldGroup(label: "pflichtstunden.field.date", error: nil) {
            DatePicker(
                "pflichtstunden.field.date",
                selection: $model.date,
                in: ...model.maxDate,
                displayedComponents: [.date]
            )
            .datePickerStyle(.compact)
            .labelsHidden()
            .tint(Theme.Colors.brand)
        }
    }

    private var hoursField: some View {
        fieldGroup(label: "pflichtstunden.field.hours", error: model.hoursError) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                TextField("pflichtstunden.field.hours.placeholder", text: $model.hoursText)
                    .keyboardType(.decimalPad)
                    .autocorrectionDisabled()
                    .monospacedDigit()
                    .modifier(DutyFieldChrome())
                    .onChange(of: model.hoursText) { model.hoursError = nil }
                    .accessibilityLabel(Text("pflichtstunden.field.hours"))
                if model.hoursError == nil {
                    Text("pflichtstunden.field.hours.hint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
        }
    }

    private var kindField: some View {
        fieldGroup(label: "pflichtstunden.field.kind", error: nil) {
            HStack(spacing: Theme.Spacing.s1) {
                ForEach(DutyKind.allCases, id: \.self) { option in
                    kindSegment(option)
                }
            }
            .padding(Theme.Spacing.s1)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())
            .accessibilityElement(children: .contain)
        }
    }

    private func kindSegment(_ option: DutyKind) -> some View {
        let isSelected = model.kind == option
        return Button {
            withAnimation(.easeOut(duration: Theme.Motion.fast)) { model.kind = option }
        } label: {
            Text(DutyHoursFormat.kindLabelKey(option))
                .font(Theme.Fonts.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .foregroundStyle(isSelected ? Theme.Colors.inkPrimary : Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(isSelected ? Theme.Colors.bgSurface : .clear)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(DutyHoursFormat.kindLabelKey(option)))
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private var noteField: some View {
        fieldGroup(label: "pflichtstunden.field.note", error: nil) {
            TextField("pflichtstunden.field.note.placeholder", text: $model.note, axis: .vertical)
                .textInputAutocapitalization(.sentences)
                .lineLimit(2...4)
                .modifier(DutyFieldChrome())
                .accessibilityLabel(Text("pflichtstunden.field.note"))
        }
    }

    private var submitButton: some View {
        RSMPrimaryButton(title: "pflichtstunden.sheet.submit", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
        .accessibilityLabel(Text("pflichtstunden.sheet.submit"))
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
private struct DutyFieldChrome: ViewModifier {
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
