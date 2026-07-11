import SwiftUI

/// Bearbeiten-Sheet eines Mitglieds: Stammdaten pflegen (`updateMember`) und
/// Rolle ändern (`changeMemberRole`). Die EINE Beere ist „Speichern"; die Rolle
/// wird sofort beim Auswählen gespeichert. 403/409 zeigen einen Alert und
/// lassen das Sheet offen. Web-Referenz: mitglieder/EditMemberSheet.tsx.
struct AdminMemberEditSheet: View {
    @StateObject private var model: AdminMemberEditViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        member: ClubMember,
        api: APIClient,
        clubId: String,
        permissions: Permissions,
        currentUserId: String?,
        onUpdated: @escaping (ClubMember) -> Void
    ) {
        _model = StateObject(wrappedValue: AdminMemberEditViewModel(
            member: member,
            api: api,
            clubId: clubId,
            permissions: permissions,
            currentUserId: currentUserId,
            onUpdated: onUpdated
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    masterCard
                    roleCard
                    saveButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text(verbatim: model.member.adminMembersDisplayName))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("mitglieder.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert(saveAlertTitle, isPresented: bind(\.saveFailure)) {
                Button("mitglieder.alert.ok", role: .cancel) {}
            } message: {
                saveAlertMessage
            }
            .alert(roleAlertTitle, isPresented: bind(\.roleFailure)) {
                Button("mitglieder.alert.ok", role: .cancel) {}
            } message: {
                roleAlertMessage
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Stammdaten

    private var masterCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "mitglieder.edit.eyebrow", title: "mitglieder.edit.master.title")

                HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                    AdminMembersFieldGroup(label: "mitglieder.field.firstName", error: model.fieldErrors.firstName) {
                        TextField("mitglieder.field.firstName", text: $model.firstName)
                            .textInputAutocapitalization(.words)
                            .modifier(AdminMembersFieldChrome())
                            .onChange(of: model.firstName) { model.fieldErrors.firstName = nil }
                    }
                    AdminMembersFieldGroup(label: "mitglieder.field.lastName", error: model.fieldErrors.lastName) {
                        TextField("mitglieder.field.lastName", text: $model.lastName)
                            .textInputAutocapitalization(.words)
                            .modifier(AdminMembersFieldChrome())
                            .onChange(of: model.lastName) { model.fieldErrors.lastName = nil }
                    }
                }

                AdminMembersFieldGroup(
                    label: "mitglieder.field.email",
                    hint: "mitglieder.field.email.hint",
                    error: model.fieldErrors.email
                ) {
                    TextField("mitglieder.field.email.placeholder", text: $model.email)
                        .textInputAutocapitalization(.never)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .modifier(AdminMembersFieldChrome())
                        .onChange(of: model.email) { model.fieldErrors.email = nil }
                }

                AdminMembersDateField(toggleLabel: "mitglieder.field.birth.toggle", date: $model.birthDate)
                birthHint

                AdminMembersFieldGroup(label: "mitglieder.field.status") {
                    statusMenu
                }
                if model.showPendingHint {
                    Text("mitglieder.field.status.pendingHint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }

                if model.showValidUntil {
                    AdminMembersFieldGroup(
                        label: "mitglieder.field.validUntil",
                        hint: "mitglieder.field.validUntil.hint"
                    ) {
                        AdminMembersDateField(
                            toggleLabel: "mitglieder.field.validUntil.toggle",
                            date: $model.validUntil
                        )
                    }
                }
            }
        }
    }

    private var birthHint: some View {
        Text("mitglieder.field.birth.hint")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkFaint)
    }

    private var statusMenu: some View {
        Menu {
            ForEach([MemberStatus.active, MemberStatus.inactive], id: \.rawValue) { option in
                Button {
                    model.status = option
                } label: {
                    if option == model.status {
                        Label(AdminMembersL10n.statusKey(option), systemImage: "checkmark")
                    } else {
                        Text(AdminMembersL10n.statusKey(option))
                    }
                }
            }
        } label: {
            menuChrome(current: AdminMembersL10n.statusKey(model.status), enabled: true)
        }
        .accessibilityLabel(Text("mitglieder.field.status"))
    }

    // MARK: - Rolle

    private var roleCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(eyebrow: "mitglieder.edit.role.eyebrow", title: "mitglieder.edit.role.title")

                HStack(spacing: Theme.Spacing.s2) {
                    Text("mitglieder.edit.role.current")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                    RSMStatusPill(
                        text: AdminMembersL10n.roleKey(model.role),
                        kind: AdminMembersL10n.roleKind(model.role)
                    )
                    if model.isChangingRole {
                        ProgressView().tint(Theme.Colors.brand)
                    }
                }

                roleMenu
                Text(model.roleHintKey)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
    }

    private var roleMenu: some View {
        Menu {
            ForEach(AssignableClubRole.allCases, id: \.rawValue) { option in
                Button {
                    _Concurrency.Task { await model.changeRole(to: option) }
                } label: {
                    if option.rawValue == model.role.rawValue {
                        Label(AdminMembersL10n.roleKey(option), systemImage: "checkmark")
                    } else {
                        Text(AdminMembersL10n.roleKey(option))
                    }
                }
                .disabled(!model.canAssign(option))
            }
        } label: {
            menuChrome(current: "mitglieder.role.select.label", enabled: model.canEditRole)
        }
        .disabled(!model.canEditRole || model.isChangingRole)
        .accessibilityLabel(Text("mitglieder.role.select.label"))
    }

    // MARK: - Speichern

    private var saveButton: some View {
        RSMPrimaryButton(title: "mitglieder.save", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.save() { dismiss() }
            }
        }
    }

    // MARK: - Menü-Chrome

    private func menuChrome(current: LocalizedStringKey, enabled: Bool) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Text(current)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(enabled ? Theme.Colors.inkPrimary : Theme.Colors.inkFaint)
            Spacer(minLength: 0)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(enabled ? Theme.Colors.inkSoft : Theme.Colors.inkFaint)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Alerts

    private func bind(_ keyPath: ReferenceWritableKeyPath<AdminMemberEditViewModel, AdminMemberEditViewModel.Failure?>) -> Binding<Bool> {
        Binding(
            get: { model[keyPath: keyPath] != nil },
            set: { if !$0 { model[keyPath: keyPath] = nil } }
        )
    }

    private var saveAlertTitle: LocalizedStringKey {
        if case .forbidden = model.saveFailure { return "mitglieder.error.forbidden.title" }
        return "mitglieder.error.save.title"
    }

    @ViewBuilder private var saveAlertMessage: some View {
        switch model.saveFailure {
        case .forbidden: Text("mitglieder.error.forbidden.save")
        case .other(let message): Text(verbatim: message)
        case nil: EmptyView()
        }
    }

    private var roleAlertTitle: LocalizedStringKey {
        if case .forbidden = model.roleFailure { return "mitglieder.error.forbidden.title" }
        return "mitglieder.error.role.title"
    }

    @ViewBuilder private var roleAlertMessage: some View {
        switch model.roleFailure {
        case .forbidden: Text("mitglieder.error.forbidden.role")
        case .other(let message): Text(verbatim: message)
        case nil: EmptyView()
        }
    }
}
