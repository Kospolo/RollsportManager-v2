import SwiftUI

/// Konto-Karte: Anmelde-E-Mail (nur lesend) und der Hinweis, dass Passwörter
/// ausschließlich über die Anmeldung geändert werden — rein informativ, keine
/// schreibende Aktion. Web-Referenz: profil/_components/AccountCard.
struct ProfileAccountCard: View {
    let email: String?

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "profil.account.eyebrow", title: "profil.account.title")

                row(icon: "envelope") {
                    Text("profil.account.emailLabel")
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                } value: {
                    if let email {
                        Text(verbatim: email)
                            .font(Theme.Fonts.body)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .textSelection(.enabled)
                    } else {
                        Text("profil.account.noEmail")
                            .font(Theme.Fonts.body)
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                }

                Divider().overlay(Theme.Colors.line)

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    HStack(spacing: Theme.Spacing.s2) {
                        Image(systemName: "lock")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Colors.inkFaint)
                            .accessibilityHidden(true)
                        Text("profil.account.passwordLabel")
                            .font(Theme.Fonts.caption.weight(.semibold))
                            .foregroundStyle(Theme.Colors.inkSoft)
                        Spacer(minLength: Theme.Spacing.s3)
                        Text("profil.account.passwordNote")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                    Text("profil.account.passwordHint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
    }

    private func row(
        icon: String,
        @ViewBuilder label: () -> some View,
        @ViewBuilder value: () -> some View
    ) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            label()
            Spacer(minLength: Theme.Spacing.s3)
            value()
                .multilineTextAlignment(.trailing)
        }
    }
}

/// Darstellungs-Karte: Sprache (DE/EN) + Erscheinungsbild (Hell/Auto/Dunkel).
/// Beide schreiben in die eigenen Präferenzen (`updateMyPreferences`). Das Theme
/// wird best-effort sofort im Screen gespiegelt; die App-Sprache folgt derzeit
/// dem System — die Auswahl wird gespeichert und greift geräteübergreifend
/// (Hinweistext). Web-Referenz: einstellungen/EinstellungenClient.
struct ProfileAppearanceCard: View {
    @ObservedObject var viewModel: ProfileViewModel
    let onChooseLocale: (String) -> Void
    let onChooseTheme: (ThemePreference) -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                RSMSectionHeader(eyebrow: "profil.appearance.eyebrow", title: "profil.appearance.title")

                settingRow(label: "profil.language.label", desc: "profil.language.desc") {
                    ProfileSegmented(
                        accessibilityLabel: "profil.language.label",
                        selection: viewModel.localeCode,
                        options: [
                            .init(value: "de", label: "profil.language.de"),
                            .init(value: "en", label: "profil.language.en"),
                        ],
                        onSelect: onChooseLocale
                    )
                }
                Text("profil.language.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)

                Divider().overlay(Theme.Colors.line)

                settingRow(label: "profil.theme.label", desc: "profil.theme.desc") {
                    ProfileSegmented(
                        accessibilityLabel: "profil.theme.label",
                        selection: viewModel.theme,
                        options: [
                            .init(value: .light, label: "profil.theme.light", systemImage: "sun.max"),
                            .init(value: .auto, label: "profil.theme.auto", systemImage: "circle.lefthalf.filled"),
                            .init(value: .dark, label: "profil.theme.dark", systemImage: "moon"),
                        ],
                        onSelect: onChooseTheme
                    )
                }
            }
        }
    }

    private func settingRow(
        label: LocalizedStringKey,
        desc: LocalizedStringKey,
        @ViewBuilder control: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(label)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(desc)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            control()
        }
    }
}

/// Benachrichtigungs-Karte: vier Schalter (Termine · Rechnungen · Neuigkeiten ·
/// Chat) in `preferences.notifications`. Optimistisch mit Rollback; der Server
/// merged partiell. Web-Referenz: einstellungen/EinstellungenClient.
struct ProfileNotificationsCard: View {
    @ObservedObject var viewModel: ProfileViewModel
    let onToggle: (ProfileViewModel.NotifKind, Bool) -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(eyebrow: "profil.notify.eyebrow", title: "profil.notify.title")

                notifyRow(.events, label: "profil.notify.events", desc: "profil.notify.events.desc")
                Divider().overlay(Theme.Colors.line)
                notifyRow(.invoices, label: "profil.notify.invoices", desc: "profil.notify.invoices.desc")
                Divider().overlay(Theme.Colors.line)
                notifyRow(.news, label: "profil.notify.news", desc: "profil.notify.news.desc")
                Divider().overlay(Theme.Colors.line)
                notifyRow(.chat, label: "profil.notify.chat", desc: "profil.notify.chat.desc")

                Text("profil.notify.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .padding(.top, Theme.Spacing.s2)
            }
        }
    }

    private func notifyRow(
        _ kind: ProfileViewModel.NotifKind,
        label: LocalizedStringKey,
        desc: LocalizedStringKey
    ) -> some View {
        Toggle(isOn: binding(for: kind)) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(label)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(desc)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .tint(Theme.Colors.brand)
        .padding(.vertical, Theme.Spacing.s1)
    }

    private func binding(for kind: ProfileViewModel.NotifKind) -> Binding<Bool> {
        Binding(
            get: { viewModel.notifValue(kind) },
            set: { onToggle(kind, $0) }
        )
    }
}
