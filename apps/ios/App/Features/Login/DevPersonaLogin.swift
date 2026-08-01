#if DEBUG
import SwiftUI

// ============================================================================
// DevPersonaLogin — die Persona-Schnellanmeldung gegen den lokalen Dev-Stack.
// NUR DEBUG-Builds. Release kennt diese Datei nicht (ganze Datei in #if DEBUG),
// dort gibt es ausschliesslich den echten E-Mail/Passwort-Login (LoginView).
// ============================================================================

/// Anzeige-Metadaten einer Persona-Karte — Spiegel der Web-Login-Karten.
/// Quelle der Wahrheit fuer sub/member_id ist services/api/src/routes/dev-login.ts.
private struct LoginPersonaCard: Identifiable {
    let persona: DevPersona
    let displayName: String
    let memberId: String
    let roleKey: LocalizedStringKey
    let descriptionKey: LocalizedStringKey
    var id: String { persona.rawValue }
}

private let personaCards: [LoginPersonaCard] = [
    .init(persona: .coach, displayName: "Sandra Vogel",
          memberId: "a0000000-0000-4000-8000-000000000001",
          roleKey: "persona.coach.role", descriptionKey: "persona.coach.description"),
    .init(persona: .owner, displayName: "Jürgen Häberle",
          memberId: "a0000000-0000-4000-8000-000000000002",
          roleKey: "persona.owner.role", descriptionKey: "persona.owner.description"),
    .init(persona: .treasurer, displayName: "Beate Schäfer",
          memberId: "a0000000-0000-4000-8000-000000000003",
          roleKey: "persona.treasurer.role", descriptionKey: "persona.treasurer.description"),
    .init(persona: .member, displayName: "Katrin Grünewald",
          memberId: "a0000000-0000-4000-8000-000000000009",
          roleKey: "persona.member.role", descriptionKey: "persona.member.description"),
    .init(persona: .guest, displayName: "Milena Öztürk",
          memberId: "a0000000-0000-4000-8000-000000000006",
          roleKey: "persona.guest.role", descriptionKey: "persona.guest.description"),
]

private let operatorCard = LoginPersonaCard(
    persona: .platform,
    displayName: "RSM Plattform-Admin",
    memberId: "90000000-0000-4000-8000-000000000090",
    roleKey: "persona.platform.role",
    descriptionKey: "persona.platform.description"
)

struct DevPersonaLogin: View {
    @EnvironmentObject private var session: SessionStore
    @State private var pendingPersona: DevPersona?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            devBanner
            ForEach(personaCards) { personaButton($0) }
            operatorSection
        }
        .padding(.top, Theme.Spacing.s4)
    }

    private var devBanner: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "wrench.and.screwdriver.fill")
                .foregroundStyle(Theme.Colors.info)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("login.devBanner.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.info)
                Text("login.devBanner.message")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.infoSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func personaButton(_ card: LoginPersonaCard) -> some View {
        Button {
            pendingPersona = card.persona
            _Concurrency.Task {
                await session.login(persona: card.persona)
                pendingPersona = nil
            }
        } label: {
            RSMCard(padding: Theme.Spacing.s4) {
                HStack(spacing: Theme.Spacing.s3) {
                    RSMAvatarView(name: card.displayName, personId: card.memberId, size: 44)
                    VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                        HStack(spacing: Theme.Spacing.s2) {
                            Text(card.displayName)
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.inkPrimary)
                            RSMStatusPill(text: card.roleKey, kind: .brand)
                        }
                        Text(card.descriptionKey)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                    if pendingPersona == card.persona && session.isLoggingIn {
                        ProgressView().tint(Theme.Colors.brand)
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Colors.inkFaint)
                            .accessibilityHidden(true)
                    }
                }
            }
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(session.isLoggingIn)
        .accessibilityLabel(Text("login.a11y.persona \(card.displayName)"))
    }

    private var operatorSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text("login.section.operator")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
                .padding(.leading, Theme.Spacing.s1)
            personaButton(operatorCard)
        }
        .padding(.top, Theme.Spacing.s3)
    }
}
#endif
