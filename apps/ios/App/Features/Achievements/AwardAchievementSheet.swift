import SwiftUI

/// „Erfolg vergeben“ als Sheet: Mitglied · Titel · Wettkampf · Medaille ·
/// Platzierung · Datum · Notiz. Die EINE Beere ist „Erfolg eintragen“. Erfolg
/// schließt das Sheet; 403 zeigt einen Alert und lässt es offen.
struct AwardAchievementSheet: View {
    @StateObject private var model: AwardAchievementViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        api: APIClient,
        clubId: String,
        members: [ClubMember],
        onCreated: @escaping (MedalAchievement) -> Void
    ) {
        _model = StateObject(wrappedValue: AwardAchievementViewModel(
            api: api,
            clubId: clubId,
            members: members,
            onCreated: onCreated
        ))
    }

    private static let medalOptions: [Medal] = [.gold, .silver, .bronze]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(eyebrow: "medaillen.form.eyebrow", title: "medaillen.form.title")
                            memberField
                            titleField
                            competitionField
                            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                                medalField
                                placementField
                            }
                            dateField
                            noteField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("medaillen.form.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("medaillen.form.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("medaillen.error.title", isPresented: submitErrorBinding) {
                Button("medaillen.error.ok", role: .cancel) {}
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

    private var memberField: some View {
        fieldGroup(label: "medaillen.form.member", hint: "medaillen.form.member.hint", error: model.fieldErrors.member) {
            Menu {
                ForEach(model.members, id: \.id) { member in
                    Button {
                        model.memberId = member.id
                        model.fieldErrors.member = nil
                    } label: {
                        Text(verbatim: MedaillenL10n.memberName(member))
                    }
                }
            } label: {
                menuLabel(
                    model.selectedMemberName.map { Text(verbatim: $0) }
                        ?? Text("medaillen.form.member.placeholder"),
                    isPlaceholder: model.memberId.isEmpty
                )
            }
            .accessibilityLabel(Text("medaillen.form.member"))
        }
    }

    private var titleField: some View {
        fieldGroup(label: "medaillen.form.titleField", hint: nil, error: model.fieldErrors.title) {
            TextField("medaillen.form.title.placeholder", text: $model.title)
                .textInputAutocapitalization(.sentences)
                .modifier(FieldChrome())
                .foregroundStyle(Theme.Colors.inkPrimary)
                .onChange(of: model.title) { model.fieldErrors.title = nil }
                .accessibilityLabel(Text("medaillen.form.titleField"))
        }
    }

    private var competitionField: some View {
        fieldGroup(label: "medaillen.form.competition", hint: nil, error: nil) {
            TextField("medaillen.form.competition.placeholder", text: $model.competition)
                .textInputAutocapitalization(.words)
                .modifier(FieldChrome())
                .foregroundStyle(Theme.Colors.inkPrimary)
                .accessibilityLabel(Text("medaillen.form.competition"))
        }
    }

    private var medalField: some View {
        fieldGroup(label: "medaillen.form.medal", hint: nil, error: nil) {
            Menu {
                Button { model.medal = nil } label: { Text("medaillen.form.medal.none") }
                ForEach(Self.medalOptions, id: \.self) { option in
                    Button { model.medal = option } label: {
                        Text(MedaillenL10n.medalLabelKey(option))
                    }
                }
            } label: {
                menuLabel(
                    model.medal == nil
                        ? Text("medaillen.form.medal.none")
                        : Text(MedaillenL10n.medalLabelKey(model.medal)),
                    isPlaceholder: false
                )
            }
            .accessibilityLabel(Text("medaillen.form.medal"))
        }
    }

    private var placementField: some View {
        fieldGroup(label: "medaillen.form.placement", hint: "medaillen.form.placement.hint", error: model.fieldErrors.placement) {
            TextField("medaillen.form.placement.placeholder", text: $model.placementText)
                .keyboardType(.numberPad)
                .modifier(FieldChrome())
                .foregroundStyle(Theme.Colors.inkPrimary)
                .onChange(of: model.placementText) { model.fieldErrors.placement = nil }
                .accessibilityLabel(Text("medaillen.form.placement"))
        }
    }

    private var dateField: some View {
        fieldGroup(label: "medaillen.form.date", hint: nil, error: nil) {
            DatePicker(
                "medaillen.form.date",
                selection: $model.achievedOn,
                displayedComponents: [.date]
            )
            .datePickerStyle(.compact)
            .labelsHidden()
            .tint(Theme.Colors.brand)
        }
    }

    private var noteField: some View {
        fieldGroup(label: "medaillen.form.note", hint: nil, error: nil) {
            TextField("medaillen.form.note.placeholder", text: $model.note, axis: .vertical)
                .lineLimit(2...4)
                .modifier(FieldChrome())
                .foregroundStyle(Theme.Colors.inkPrimary)
                .accessibilityLabel(Text("medaillen.form.note"))
        }
    }

    private var submitButton: some View {
        RSMPrimaryButton(title: "medaillen.form.submit", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
    }

    // MARK: - Bausteine

    private func menuLabel(_ content: Text, isPlaceholder: Bool) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            content
                .foregroundStyle(isPlaceholder ? Theme.Colors.inkFaint : Theme.Colors.inkPrimary)
                .lineLimit(1)
            Spacer(minLength: 0)
            Image(systemName: "chevron.up.chevron.down")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .modifier(FieldChrome())
    }

    private func fieldGroup(
        label: LocalizedStringKey,
        hint: LocalizedStringKey?,
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
            } else if let hint {
                Text(hint)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Einheitliches Eingabefeld-Chrome: Body-Schrift, Mulden-Fläche, Radius M.
private struct FieldChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Theme.Fonts.body)
            .padding(Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.touchTarget, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}
