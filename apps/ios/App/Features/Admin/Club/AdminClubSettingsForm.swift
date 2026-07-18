import SwiftUI

/// Editierbares Formular der Vereins-Einstellungen (owner/admin). Vier Karten —
/// Stammdaten · Kontakt · Bankverbindung · Benachrichtigungen — plus eine
/// Aktionsleiste mit genau EINER Beere („Änderungen speichern") und „Verwerfen".
/// Schreibt über den ViewModel (`updateClubSettings`); die eine Primäraktion
/// bleibt inaktiv, solange nichts geändert wurde. Web-Referenz: VereinForm.
struct AdminClubSettingsForm: View {
    @ObservedObject var model: AdminClubSettingsViewModel
    let onSave: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if let club = model.club {
                    AdminClubLogoCard(
                        clubId: club.id,
                        canEdit: true,
                        initialHasLogo: club.logoAssetId != nil
                    )
                }
                coreCard
                contactCard
                bankCard
                notifyCard
                actions
                Text("verein.note")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
    }

    // MARK: - Stammdaten

    private var coreCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "verein.core.eyebrow", title: "verein.core.title")

                ClubFieldGroup(label: "verein.field.name", hint: "verein.field.name.hint", error: model.nameError) {
                    TextField("verein.field.name", text: $model.name)
                        .textInputAutocapitalization(.words)
                        .modifier(ClubFieldChrome())
                        .onChange(of: model.name) { model.nameError = nil }
                        .accessibilityLabel(Text("verein.field.name"))
                }
                ClubFieldGroup(label: "verein.field.shortName", hint: "verein.field.shortName.hint") {
                    TextField("verein.field.shortName", text: $model.shortName)
                        .modifier(ClubFieldChrome())
                        .accessibilityLabel(Text("verein.field.shortName"))
                }
                ClubFieldGroup(label: "verein.field.city") {
                    TextField("verein.field.city", text: $model.city)
                        .textInputAutocapitalization(.words)
                        .modifier(ClubFieldChrome())
                        .accessibilityLabel(Text("verein.field.city"))
                }
                ClubFieldGroup(label: "verein.field.discipline") {
                    TextField("verein.field.discipline.ph", text: $model.discipline)
                        .modifier(ClubFieldChrome())
                        .accessibilityLabel(Text("verein.field.discipline"))
                }
            }
        }
    }

    // MARK: - Kontakt

    private var contactCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "verein.contact.eyebrow", title: "verein.contact.title")

                ClubFieldGroup(label: "verein.field.email", error: model.emailError) {
                    TextField("verein.field.email.ph", text: $model.email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .modifier(ClubFieldChrome())
                        .onChange(of: model.email) { model.emailError = nil }
                        .accessibilityLabel(Text("verein.field.email"))
                }
                ClubFieldGroup(label: "verein.field.phone") {
                    TextField("verein.field.phone.ph", text: $model.phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .modifier(ClubFieldChrome())
                        .accessibilityLabel(Text("verein.field.phone"))
                }
                ClubFieldGroup(label: "verein.field.address") {
                    TextField("verein.field.address.ph", text: $model.address, axis: .vertical)
                        .lineLimit(1...3)
                        .modifier(ClubFieldChrome())
                        .accessibilityLabel(Text("verein.field.address"))
                }
            }
        }
    }

    // MARK: - Bankverbindung

    private var bankCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "verein.bank.eyebrow", title: "verein.bank.title")

                ClubFieldGroup(label: "verein.field.iban", error: model.ibanError) {
                    TextField("verein.field.iban.ph", text: $model.iban)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .modifier(ClubFieldChrome())
                        .onChange(of: model.iban) { model.ibanError = nil }
                        .accessibilityLabel(Text("verein.field.iban"))
                }
                ClubFieldGroup(label: "verein.field.accountHolder") {
                    TextField("verein.field.accountHolder.ph", text: $model.accountHolder)
                        .textInputAutocapitalization(.words)
                        .modifier(ClubFieldChrome())
                        .accessibilityLabel(Text("verein.field.accountHolder"))
                }
                ClubFieldGroup(label: "verein.field.bankName") {
                    TextField("verein.field.bankName.ph", text: $model.bankName)
                        .modifier(ClubFieldChrome())
                        .accessibilityLabel(Text("verein.field.bankName"))
                }
            }
        }
    }

    // MARK: - Benachrichtigungen

    private var notifyCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(eyebrow: "verein.notify.eyebrow", title: "verein.notify.title")

                ClubNotifyRow(
                    title: "verein.notify.invoices",
                    desc: "verein.notify.invoices.desc",
                    isOn: $model.notifyInvoices
                )
                Divider().overlay(Theme.Colors.line)
                ClubNotifyRow(
                    title: "verein.notify.events",
                    desc: "verein.notify.events.desc",
                    isOn: $model.notifyEvents
                )
                Divider().overlay(Theme.Colors.line)
                ClubNotifyRow(
                    title: "verein.notify.news",
                    desc: "verein.notify.news.desc",
                    isOn: $model.notifyNews
                )
            }
        }
    }

    // MARK: - Aktionen

    private var actions: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Button {
                model.reset()
            } label: {
                Text("verein.reset")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(model.isDirty ? Theme.Colors.inkSoft : Theme.Colors.inkFaint)
                    .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
            }
            .buttonStyle(RSMPressableButtonStyle())
            .disabled(!model.isDirty || model.isSaving)

            RSMPrimaryButton(
                title: model.isSaving ? "verein.saving" : "verein.save",
                isLoading: model.isSaving,
                action: onSave
            )
            .disabled(!model.isDirty || model.isSaving)
            .opacity(model.isDirty ? 1 : 0.5)
        }
    }
}
