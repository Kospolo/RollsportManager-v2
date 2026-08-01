import SwiftUI

/// Anmelde-Bildschirm: echter E-Mail/Passwort-Login + Registrierung gegen die
/// live API (/auth/login, /auth/register). Die Persona-Schnellanmeldung (Dev-
/// Stack) steht NUR in DEBUG-Builds darunter — Release zeigt sie nie.
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var isRegistering = false

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 8
            && (!isRegistering || !displayName.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                header
                authForm
                if let error = session.loginError {
                    errorCard(error)
                }
#if DEBUG
                DevPersonaLogin()
#endif
            }
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .animation(.easeOut(duration: Theme.Motion.standard), value: session.loginError)
        .animation(.easeOut(duration: Theme.Motion.standard), value: isRegistering)
    }

    // MARK: - Kopf

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
        }
        .padding(.top, Theme.Spacing.s6)
    }

    // MARK: - Formular

    private var authForm: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                if isRegistering {
                    labeledField("Name", text: $displayName)
                }
                labeledField("E-Mail", text: $email, isEmail: true)
                labeledSecureField(isRegistering ? "Passwort (min. 8 Zeichen)" : "Passwort")

                Button(action: submit) {
                    HStack(spacing: Theme.Spacing.s2) {
                        if session.isLoggingIn {
                            ProgressView().tint(Theme.Colors.brandContrast)
                        }
                        Text(isRegistering ? "Konto erstellen" : "Anmelden")
                            .font(Theme.Fonts.bodyStrong)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.s3)
                    .background(canSubmit ? Theme.Colors.brand : Theme.Colors.lineStrong)
                    .foregroundStyle(Theme.Colors.brandContrast)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(session.isLoggingIn || !canSubmit)

                Button {
                    isRegistering.toggle()
                    session.loginError = nil
                } label: {
                    Text(isRegistering ? "Schon ein Konto? Anmelden"
                                       : "Neu hier? Konto erstellen")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.brandInk)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, Theme.Spacing.s1)
            }
        }
    }

    private func submit() {
        _Concurrency.Task {
            if isRegistering {
                await session.register(email: email, password: password, displayName: displayName)
            } else {
                await session.signIn(email: email, password: password)
            }
        }
    }

    // MARK: - Feld-Bausteine (cross-platform)

    private func labeledField(_ title: String, text: Binding<String>, isEmail: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(title).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.inkSoft)
            TextField("", text: text)
                .autocorrectionDisabled()
                .modifier(EmailFieldTraits(isEmail: isEmail))
                .padding(Theme.Spacing.s3)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    private func labeledSecureField(_ title: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(title).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.inkSoft)
            SecureField("", text: $password)
                .padding(Theme.Spacing.s3)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
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
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.dangerSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }
}

/// iOS-spezifische Tastatur-/AutoFill-Feinheiten (E-Mail). Auf macOS ein No-op —
/// UITextContentType/UIKeyboardType existieren dort nicht.
private struct EmailFieldTraits: ViewModifier {
    let isEmail: Bool
    func body(content: Content) -> some View {
#if os(iOS)
        if isEmail {
            content
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
        } else {
            content
        }
#else
        content
#endif
    }
}
