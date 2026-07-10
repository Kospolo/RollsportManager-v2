import SwiftUI

/// „Neuer Termin“ als Sheet: Titel · Art · Datum · Beginn/Ende · Ort ·
/// Team-Mehrfachauswahl (Chips) · Notiz. Die EINE Beere ist „Anlegen“.
/// Erfolg schließt das Sheet; 403 zeigt einen Alert und lässt es offen.
struct NewEventSheet: View {
    @StateObject private var model: NewEventViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        api: APIClient,
        clubId: String,
        teams: [Team],
        onCreated: @escaping (Event) -> Void
    ) {
        _model = StateObject(wrappedValue: NewEventViewModel(
            api: api,
            clubId: clubId,
            teams: teams,
            onCreated: onCreated
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(eyebrow: "newEvent.eyebrow", title: "newEvent.title")
                            titleField
                            typeField
                            dateField
                            timeFields
                            locationField
                            teamsField
                            noteField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("newEvent.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("newEvent.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("events.error.title", isPresented: submitErrorBinding) {
                Button("events.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: model.submitError ?? "")
            }
#if DEBUG
            .task {
                // NUR DEBUG/Smoke-Test: `-devAutoSubmitEvent YES` fährt nach
                // kurzer Renderpause denselben echten Anlegen-Pfad wie der
                // „Anlegen“-Button (POST /events) und schließt bei Erfolg.
                guard UserDefaults.standard.bool(forKey: "devAutoSubmitEvent") else { return }
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
        fieldGroup(label: "newEvent.field.title", error: model.fieldErrors.title) {
            TextField("newEvent.field.title.placeholder", text: $model.title)
                .textInputAutocapitalization(.sentences)
                .modifier(RSMFieldChrome())
                .onChange(of: model.title) { model.fieldErrors.title = nil }
                .accessibilityLabel(Text("newEvent.field.title"))
        }
    }

    private var typeField: some View {
        fieldGroup(label: "newEvent.field.type", error: nil) {
            HStack(spacing: Theme.Spacing.s1) {
                ForEach(EventType.allCases, id: \.self) { option in
                    typeSegment(option)
                }
            }
            .padding(Theme.Spacing.s1)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())
            .accessibilityElement(children: .contain)
        }
    }

    private func typeSegment(_ option: EventType) -> some View {
        let isSelected = model.type == option
        return Button {
            withAnimation(.easeOut(duration: Theme.Motion.fast)) { model.type = option }
        } label: {
            Text(EventsDisplay.typeLabelKey(option))
                .font(Theme.Fonts.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(isSelected ? Theme.Colors.inkPrimary : Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(isSelected ? Theme.Colors.bgSurface : .clear)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(EventsDisplay.typeLabelKey(option)))
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private var dateField: some View {
        fieldGroup(label: "newEvent.field.date", error: nil) {
            DatePicker(
                "newEvent.field.date",
                selection: $model.day,
                displayedComponents: [.date]
            )
            .datePickerStyle(.compact)
            .labelsHidden()
            .tint(Theme.Colors.brand)
        }
    }

    private var timeFields: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            fieldGroup(label: "newEvent.field.start", error: nil) {
                DatePicker(
                    "newEvent.field.start",
                    selection: $model.startTime,
                    displayedComponents: [.hourAndMinute]
                )
                .datePickerStyle(.compact)
                .labelsHidden()
                .tint(Theme.Colors.brand)
                .onChange(of: model.startTime) { model.fieldErrors.end = nil }
            }
            fieldGroup(label: "newEvent.field.end", error: model.fieldErrors.end) {
                DatePicker(
                    "newEvent.field.end",
                    selection: $model.endTime,
                    displayedComponents: [.hourAndMinute]
                )
                .datePickerStyle(.compact)
                .labelsHidden()
                .tint(Theme.Colors.brand)
                .onChange(of: model.endTime) { model.fieldErrors.end = nil }
            }
        }
    }

    private var locationField: some View {
        fieldGroup(label: "newEvent.field.location", error: model.fieldErrors.location) {
            TextField("newEvent.field.location.placeholder", text: $model.location)
                .textInputAutocapitalization(.words)
                .modifier(RSMFieldChrome())
                .onChange(of: model.location) { model.fieldErrors.location = nil }
                .accessibilityLabel(Text("newEvent.field.location"))
        }
    }

    @ViewBuilder private var teamsField: some View {
        if !model.teams.isEmpty {
            fieldGroup(label: "newEvent.field.teams", error: model.fieldErrors.teams) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 96), spacing: Theme.Spacing.s2)],
                        alignment: .leading,
                        spacing: Theme.Spacing.s2
                    ) {
                        ForEach(model.teams, id: \.id) { team in
                            teamChip(team)
                        }
                    }
                    if model.fieldErrors.teams == nil {
                        Text("newEvent.field.teams.hint")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                }
                .accessibilityElement(children: .contain)
            }
        }
    }

    private func teamChip(_ team: Team) -> some View {
        let active = model.isTeamSelected(team.id)
        return Button {
            withAnimation(.easeOut(duration: Theme.Motion.fast)) { model.toggleTeam(team.id) }
        } label: {
            Text(verbatim: team.name)
                .font(Theme.Fonts.caption.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(active ? Theme.Colors.brandInk : Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .padding(.horizontal, Theme.Spacing.s3)
                .background(active ? Theme.Colors.brandSoft : Theme.Colors.bgSurface)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(
                        active ? .clear : Theme.Colors.lineStrong,
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(verbatim: team.name))
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    private var noteField: some View {
        fieldGroup(label: "newEvent.field.note", error: nil) {
            TextField("newEvent.field.note.placeholder", text: $model.note, axis: .vertical)
                .lineLimit(2...4)
                .modifier(RSMFieldChrome())
                .accessibilityLabel(Text("newEvent.field.note"))
        }
    }

    private var submitButton: some View {
        RSMPrimaryButton(title: "newEvent.submit", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
        .accessibilityLabel(Text("newEvent.a11y.submit"))
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
private struct RSMFieldChrome: ViewModifier {
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
