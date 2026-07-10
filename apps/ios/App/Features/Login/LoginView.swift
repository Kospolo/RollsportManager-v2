import SwiftUI

/// Anzeige-Metadaten der Persona-Karten — Spiegel der Web-Login-Karten
/// (apps/web/lib/auth/personas.ts). Quelle der Wahrheit für sub/member_id
/// ist services/api/src/routes/dev-login.ts; hier stehen nur UI-Texte.
private struct LoginPersonaCard: Identifiable {
    let persona: DevPersona
    let displayName: String
    /// app.club_members.id aus dem Seed — für den deterministischen Avatar-Ton.
    let memberId: String
    let roleKey: LocalizedStringKey
    let descriptionKey: LocalizedStringKey

    var id: String { persona.rawValue }
}

private let personaCards: [LoginPersonaCard] = [
    .init(
        persona: .coach,
        displayName: "Sandra Vogel",
        memberId: "a0000000-0000-4000-8000-000000000001",
        roleKey: "persona.coach.role",
        descriptionKey: "persona.coach.description"
    ),
    .init(
        persona: .owner,
        displayName: "Jürgen Häberle",
        memberId: "a0000000-0000-4000-8000-000000000002",
        roleKey: "persona.owner.role",
        descriptionKey: "persona.owner.description"
    ),
    .init(
        persona: .treasurer,
        displayName: "Beate Schäfer",
        memberId: "a0000000-0000-4000-8000-000000000003",
        roleKey: "persona.treasurer.role",
        descriptionKey: "persona.treasurer.description"
    ),
    .init(
        persona: .member,
        displayName: "Katrin Grünewald",
        memberId: "a0000000-0000-4000-8000-000000000009",
        roleKey: "persona.member.role",
        descriptionKey: "persona.member.description"
    ),
    .init(
        persona: .guest,
        displayName: "Milena Öztürk",
        memberId: "a0000000-0000-4000-8000-000000000006",
        roleKey: "persona.guest.role",
        descriptionKey: "persona.guest.description"
    ),
]

/// Persona-Login gegen den lokalen Dev-Stack — wie die Web-Login-Karten.
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var pendingPersona: DevPersona?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                header
                devBanner
                ForEach(personaCards) { card in
                    personaButton(card)
                }
                if let error = session.loginError {
                    errorCard(error)
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .animation(.easeOut(duration: Theme.Motion.standard), value: session.loginError)
    }

    // MARK: - Bausteine

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("login.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.brandInk)
            Text("login.title")
                .font(Theme.Fonts.display)
                .tracking(Theme.Fonts.displayTracking)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text("login.subtitle")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .padding(.top, Theme.Spacing.s6)
    }

    /// Dev-Hinweis-Banner: nichts hier ist Produktion.
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
            // `Task` ist in diesem Modul der Contracts-Struct — daher voll
            // qualifiziert `_Concurrency.Task` für Swift Concurrency.
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
                        ProgressView()
                            .tint(Theme.Colors.brand)
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
        .accessibilityLabel(
            Text("login.a11y.persona \(card.displayName)")
        )
    }

    private func errorCard(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.danger)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("login.error.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.danger)
                Text(message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                Text("login.error.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.dangerSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }
}
