import SwiftUI

/// „Reservieren“-Sheet: Mitglied (nur Trainerstab wählbar) · Menge · Zeitraum
/// (von/bis) → `createReservation`. Die EINE Beere ist „Reservieren“. Erfolg
/// schließt das Sheet und meldet die erzeugte Reservierung zurück; 403/409
/// bleiben als Alert im Sheet. Web-Referenz: ausruestung/_components/ReserveSheet.tsx.
struct EquipmentReserveSheet: View {
    @StateObject private var model: EquipmentReserveViewModel
    @Environment(\.dismiss) private var dismiss

    /// Aktive Mitglieder für die Trainer-Auswahl (leer = nur Selbst-Buchung).
    private let selectableMembers: [ClubMember]
    private let canSelectMember: Bool
    private let currentMemberName: String
    private let onReserved: (EquipmentReservation) -> Void

    init(
        api: APIClient,
        clubId: String,
        equipment: Equipment,
        currentMemberId: String,
        currentMemberName: String,
        canSelectMember: Bool,
        selectableMembers: [ClubMember],
        onReserved: @escaping (EquipmentReservation) -> Void
    ) {
        _model = StateObject(wrappedValue: EquipmentReserveViewModel(
            api: api,
            clubId: clubId,
            equipment: equipment,
            defaultMemberId: currentMemberId
        ))
        self.canSelectMember = canSelectMember
        self.selectableMembers = selectableMembers
        self.currentMemberName = currentMemberName
        self.onReserved = onReserved
    }

    /// Anzeigename eines Mitglieds (Vor- + Nachname), robust gegen Leerwerte.
    private func memberLabel(_ member: ClubMember) -> String {
        let name = "\(member.firstName) \(member.lastName)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? member.id : name
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(
                                eyebrow: "ausruestung.reserve.eyebrow",
                                title: LocalizedStringKey(stringLiteral: model.equipment.name)
                            )
                            memberField
                            quantityField
                            rangeField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("ausruestung.reserve.cta"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("ausruestung.reserve.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("ausruestung.reserve.error.title", isPresented: submitErrorBinding) {
                Button("ausruestung.error.ok", role: .cancel) {}
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

    // MARK: - Mitglied (Trainer wählt, sonst fest auf sich selbst)

    @ViewBuilder
    private var memberField: some View {
        if canSelectMember && !selectableMembers.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("ausruestung.reserve.member")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Picker("ausruestung.reserve.member", selection: $model.reservedByMemberId) {
                    ForEach(selectableMembers, id: \.id) { member in
                        Text(verbatim: memberLabel(member)).tag(member.id)
                    }
                }
                .pickerStyle(.menu)
                .tint(Theme.Colors.brand)
                .frame(maxWidth: .infinity, alignment: .leading)
                Text("ausruestung.reserve.member.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        } else {
            Text("ausruestung.reserve.forSelf \(currentMemberName)")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .padding(Theme.Spacing.s3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    // MARK: - Menge

    private var quantityField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Stepper(value: $model.quantity, in: 1...model.quantityUpperBound) {
                HStack(spacing: Theme.Spacing.s2) {
                    Text("ausruestung.reserve.quantity")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Spacer(minLength: 0)
                    Text(verbatim: "\(model.quantity)")
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                }
            }
            .tint(Theme.Colors.brand)
            .onChange(of: model.quantity) { model.fieldErrors.quantity = nil }

            if let cap = model.cap {
                Text("ausruestung.reserve.quantity.hint \(cap)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            } else {
                Text("ausruestung.reserve.quantity.hintUnknown")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            if let error = model.fieldErrors.quantity {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
    }

    // MARK: - Zeitraum

    private var rangeField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            DatePicker(
                "ausruestung.reserve.from",
                selection: $model.fromDate,
                displayedComponents: [.date, .hourAndMinute]
            )
            .tint(Theme.Colors.brand)
            .onChange(of: model.fromDate) { model.fieldErrors.range = nil }

            DatePicker(
                "ausruestung.reserve.to",
                selection: $model.toDate,
                displayedComponents: [.date, .hourAndMinute]
            )
            .tint(Theme.Colors.brand)
            .onChange(of: model.toDate) { model.fieldErrors.range = nil }

            if let error = model.fieldErrors.range {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .font(Theme.Fonts.bodyStrong)
        .foregroundStyle(Theme.Colors.inkPrimary)
    }

    // MARK: - Absenden

    private var submitButton: some View {
        RSMPrimaryButton(title: "ausruestung.reserve.submit", isLoading: model.isSaving) {
            _Concurrency.Task {
                if let created = await model.submit() {
                    onReserved(created)
                    dismiss()
                }
            }
        }
    }
}
