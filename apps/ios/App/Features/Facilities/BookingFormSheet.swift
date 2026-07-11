import SwiftUI

/// „Halle buchen“-Sheet: Halle · Titel · (Mitglied) · Team · Datum · Beginn ·
/// Ende · (Status) → `createBooking`. Die EINE Beere ist „Buchen“. Erfolg
/// schließt das Sheet; 403 zeigt einen Alert und lässt es offen. Ein
/// Überschneidungs-Hinweis erscheint nicht-blockierend.
struct BookingFormSheet: View {
    @StateObject private var model: BookingFormViewModel
    @Environment(\.dismiss) private var dismiss

    init(model: @autoclosure @escaping () -> BookingFormViewModel) {
        _model = StateObject(wrappedValue: model())
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(
                                eyebrow: "belegungsplan.book.eyebrow",
                                title: "belegungsplan.book.title"
                            )
                            facilityField
                            titleField
                            memberField
                            if !model.bookableTeamsAvailable.isEmpty { teamField }
                            dateField
                            timeFields
                            statusField
                            conflictHint
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("belegungsplan.book.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("belegungsplan.book.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("belegungsplan.error.title", isPresented: submitErrorBinding) {
                Button("belegungsplan.error.ok", role: .cancel) {}
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

    private var facilityField: some View {
        fieldGroup(label: "belegungsplan.book.facility", error: nil) {
            Menu {
                Picker("belegungsplan.book.facility", selection: $model.facilityId) {
                    ForEach(model.facilities, id: \.id) { facility in
                        Text(verbatim: facility.name).tag(facility.id)
                    }
                }
            } label: {
                menuLabel(text: model.selectedFacilityName)
            }
        }
    }

    private var titleField: some View {
        fieldGroup(label: "belegungsplan.book.field.title", error: model.fieldErrors.title) {
            TextField("belegungsplan.book.field.title.placeholder", text: $model.title)
                .textInputAutocapitalization(.sentences)
                .modifier(BookingFieldChrome())
                .onChange(of: model.title) { model.fieldErrors.title = nil }
        }
    }

    @ViewBuilder
    private var memberField: some View {
        if model.isTrainer {
            fieldGroup(label: "belegungsplan.book.member", error: nil) {
                Menu {
                    Picker("belegungsplan.book.member", selection: $model.memberId) {
                        ForEach(model.members, id: \.id) { member in
                            Text(verbatim: "\(member.firstName) \(member.lastName)").tag(member.id)
                        }
                    }
                } label: {
                    menuLabel(text: model.effectiveMemberName ?? selfLabel)
                }
            }
        } else {
            fieldGroup(label: "belegungsplan.book.member", error: nil) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    HStack(spacing: Theme.Spacing.s2) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Colors.inkFaint)
                        Text(verbatim: model.effectiveMemberName ?? selfLabel)
                            .font(Theme.Fonts.body)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                    }
                    .padding(Theme.Spacing.s3)
                    .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
                    .background(Theme.Colors.bgSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    Text("belegungsplan.book.member.selfHint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
        }
    }

    private var teamField: some View {
        fieldGroup(label: "belegungsplan.book.team", error: nil) {
            Menu {
                Picker("belegungsplan.book.team", selection: $model.teamId) {
                    Text("belegungsplan.book.team.none").tag("")
                    ForEach(model.bookableTeamsAvailable, id: \.id) { team in
                        Text(verbatim: team.name).tag(team.id)
                    }
                }
            } label: {
                menuLabel(text: model.selectedTeamName)
            }
        }
    }

    private var dateField: some View {
        fieldGroup(label: "belegungsplan.book.date", error: nil) {
            DatePicker("belegungsplan.book.date", selection: $model.day, displayedComponents: [.date])
                .datePickerStyle(.compact)
                .labelsHidden()
                .tint(Theme.Colors.brand)
        }
    }

    private var timeFields: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            fieldGroup(label: "belegungsplan.book.start", error: nil) {
                DatePicker("belegungsplan.book.start", selection: $model.startTime, displayedComponents: [.hourAndMinute])
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .tint(Theme.Colors.brand)
                    .onChange(of: model.startTime) { model.fieldErrors.end = nil }
            }
            fieldGroup(label: "belegungsplan.book.end", error: model.fieldErrors.end) {
                DatePicker("belegungsplan.book.end", selection: $model.endTime, displayedComponents: [.hourAndMinute])
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .tint(Theme.Colors.brand)
                    .onChange(of: model.endTime) { model.fieldErrors.end = nil }
            }
        }
    }

    @ViewBuilder
    private var statusField: some View {
        if model.isTrainer {
            fieldGroup(label: "belegungsplan.book.status", error: nil) {
                Picker("belegungsplan.book.status", selection: $model.status) {
                    Text("belegungsplan.status.confirmed").tag(BookingStatus.confirmed)
                    Text("belegungsplan.status.pending").tag(BookingStatus.pending)
                }
                .pickerStyle(.segmented)
            }
        } else {
            Text("belegungsplan.book.status.memberHint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .padding(Theme.Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    @ViewBuilder
    private var conflictHint: some View {
        if model.conflictCount > 0 {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Label {
                    Text(conflictText)
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.warn)
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Colors.warn)
                }
                Text("belegungsplan.book.conflict.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Colors.warnSoft)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    private var conflictText: LocalizedStringKey {
        model.conflictCount == 1
            ? "belegungsplan.book.conflict.one"
            : "belegungsplan.book.conflict.many \(model.conflictCount)"
    }

    private var submitButton: some View {
        RSMPrimaryButton(title: "belegungsplan.book.submit", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.submit() { dismiss() }
            }
        }
    }

    // MARK: - Bausteine

    private var selfLabel: String {
        NSLocalizedString("belegungsplan.book.member.self", comment: "Buchung für sich selbst")
    }

    private func menuLabel(text: String) -> some View {
        HStack {
            Text(verbatim: text)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(1)
            Spacer(minLength: Theme.Spacing.s2)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .padding(Theme.Spacing.s3)
        .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

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
private struct BookingFieldChrome: ViewModifier {
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
