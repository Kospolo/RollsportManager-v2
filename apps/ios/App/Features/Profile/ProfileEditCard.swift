import SwiftUI

/// Bearbeiten-Karte des eigenen Profils: Vorname · Nachname · E-Mail ·
/// Geburtsdatum. Schreibt über `updateMyProfile` (PATCH /me, `member_id = self`
/// serverseitig erzwungen) — es wird nur der DIFF gesendet. Die EINE „Beere“ ist
/// „Änderungen speichern“; sie ist inaktiv, solange nichts geändert wurde. Ein
/// 403 kommt als Klartext-Meldung zurück, das Formular bleibt offen.
/// Web-Referenz: profil/_components/ProfileEditCard.
struct ProfileEditCard: View {
    @ObservedObject var viewModel: ProfileViewModel
    let onSave: () -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "profil.edit.eyebrow", title: "profil.edit.title")
                Text("profil.edit.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)

                nameFields
                emailField
                birthField

                if viewModel.profileSaved {
                    savedConfirmation
                }

                actions
            }
        }
    }

    // MARK: - Felder

    private var nameFields: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            fieldGroup(label: "profil.field.firstName", error: viewModel.firstNameError) {
                TextField("profil.field.firstName.ph", text: $viewModel.firstName)
                    .textContentType(.givenName)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .modifier(ProfileFieldChrome())
                    .onChange(of: viewModel.firstName) { viewModel.firstNameError = nil }
                    .accessibilityLabel(Text("profil.field.firstName"))
            }
            fieldGroup(label: "profil.field.lastName", error: viewModel.lastNameError) {
                TextField("profil.field.lastName.ph", text: $viewModel.lastName)
                    .textContentType(.familyName)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .modifier(ProfileFieldChrome())
                    .onChange(of: viewModel.lastName) { viewModel.lastNameError = nil }
                    .accessibilityLabel(Text("profil.field.lastName"))
            }
        }
    }

    private var emailField: some View {
        fieldGroup(label: "profil.field.email", error: viewModel.emailError) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                TextField("profil.field.email.ph", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .modifier(ProfileFieldChrome())
                    .onChange(of: viewModel.email) { viewModel.emailError = nil }
                    .accessibilityLabel(Text("profil.field.email"))
                if viewModel.emailError == nil {
                    Text("profil.field.email.hint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
    }

    @ViewBuilder
    private var birthField: some View {
        fieldGroup(label: "profil.field.birth", error: nil) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                if viewModel.hasBirthDate {
                    DatePicker(
                        "profil.field.birth",
                        selection: $viewModel.birthDate,
                        in: ...Date(),
                        displayedComponents: [.date]
                    )
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("profil.field.birth"))
                    Text(birthHint)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } else {
                    Button {
                        withAnimation(.easeOut(duration: Theme.Motion.fast)) {
                            viewModel.hasBirthDate = true
                        }
                    } label: {
                        Label("profil.field.birth.toggle", systemImage: "calendar.badge.plus")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.brandInk)
                            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                            .background(Theme.Colors.brandSoft)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    }
                    .buttonStyle(RSMPressableButtonStyle())
                    Text("profil.field.birth.hint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
    }

    private var birthHint: String {
        let base = NSLocalizedString("profil.field.birth.hint", comment: "Geburtsdatum-Hinweis")
        let wire = ProfileFormat.wireString(from: viewModel.birthDate)
        guard let age = ProfileFormat.ageYears(fromWire: wire) else { return base }
        let ageText = String(
            format: NSLocalizedString("profil.field.birth.age %lld", comment: "Alter in Jahren"),
            age
        )
        return "\(base) · \(ageText)"
    }

    // MARK: - Aktionen + Bestätigung

    private var savedConfirmation: some View {
        Label("profil.saved", systemImage: "checkmark.circle.fill")
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(Theme.Colors.success)
            .transition(.opacity)
    }

    private var actions: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Button {
                viewModel.resetForm()
            } label: {
                Text("profil.reset")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(viewModel.isProfileDirty ? Theme.Colors.inkSoft : Theme.Colors.inkFaint)
                    .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
            }
            .buttonStyle(RSMPressableButtonStyle())
            .disabled(!viewModel.isProfileDirty || viewModel.isSavingProfile)

            RSMPrimaryButton(title: "profil.save", isLoading: viewModel.isSavingProfile) {
                onSave()
            }
            .disabled(!viewModel.isProfileDirty || viewModel.isSavingProfile)
            .opacity(viewModel.isProfileDirty ? 1 : 0.5)
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
