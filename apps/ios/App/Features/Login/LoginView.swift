import SwiftUI

// ============================================================================
// LoginView — Willkommen + echtes Login/Registrieren (Design „Bewegung & Wärme",
// abgenommen 2026-08-02). Warme Korall-/Gold-Palette, die WELLENFORM aus dem
// Kür-Player als Signatur, athletische Titel. iPhone: Hero → Feature-Karten →
// Formular. iPad: ZWEISPALTIG (Marke/Vorstellung links im Verlauf, Login rechts)
// — nutzt die Fläche statt einer schmalen Spalte im Leeren.
//
// Persona-Schnellanmeldung nur in DEBUG (Rechte-Test); Release zeigt nur Login.
// ============================================================================

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var hSize
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var isRegistering = false
    @State private var appeared = false

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 8
            && (!isRegistering || !displayName.trimmingCharacters(in: .whitespaces).isEmpty)
    }

    var body: some View {
        Group {
            if hSize == .regular {
                iPadLayout
            } else {
                iPhoneLayout
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .animation(.easeOut(duration: Theme.Motion.standard), value: session.loginError)
        .animation(.easeOut(duration: Theme.Motion.standard), value: isRegistering)
        .onAppear {
            guard !appeared else { return }
            if reduceMotion { appeared = true }
            else { withAnimation(.smooth(duration: 0.55)) { appeared = true } }
        }
    }

    // MARK: - iPhone (Hero → Features → Formular)

    private var iPhoneLayout: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                heroCard
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 14)
                features
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 18)
                authForm
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 22)
                if let error = session.loginError { errorCard(error) }
#if DEBUG
                DevPersonaLogin()
#endif
            }
            .frame(maxWidth: 540)
            .frame(maxWidth: .infinity)
            .padding(Theme.Spacing.s5)
        }
    }

    /// Hero als warme Verlaufs-Karte mit Wellenform-Signatur unten.
    private var heroCard: some View {
        ZStack(alignment: .bottomLeading) {
            WarmPalette.heroGradient
            WaveformStrip(color: .white.opacity(0.55), reduceMotion: reduceMotion)
                .frame(height: 84)
                .frame(maxWidth: .infinity, alignment: .bottom)
                .allowsHitTesting(false)
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                brandTile
                    .padding(.bottom, Theme.Spacing.s2)
                Text("login.eyebrow")
                    .font(Theme.Fonts.eyebrow).tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase).foregroundStyle(.white.opacity(0.9))
                Text("login.title")
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                Text("login.subtitle")
                    .font(Theme.Fonts.body).foregroundStyle(.white.opacity(0.92))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, Theme.Spacing.s6)
            }
            .padding(Theme.Spacing.s5)
        }
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .shadow(color: WarmPalette.coral.opacity(0.32), radius: 20, x: 0, y: 12)
    }

    private var brandTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(LinearGradient(colors: [WarmPalette.peach, WarmPalette.coral],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
            Text(verbatim: "R").font(.system(size: 30, weight: .black, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: 64, height: 64)
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(.white.opacity(0.35), lineWidth: 1))
        .scaleEffect(appeared ? 1 : 0.82)
        .animation(reduceMotion ? nil : .spring(duration: 0.6, bounce: 0.35), value: appeared)
    }

    // MARK: - Vorstellung „was kann die App"

    private var features: some View {
        VStack(spacing: Theme.Spacing.s3) {
            featureRow(symbol: "music.note", tint: WarmPalette.coralDeep, bg: WarmPalette.coralSoft,
                       title: "login.feature.routines.title", desc: "login.feature.routines.desc")
            featureRow(symbol: "trophy.fill", tint: WarmPalette.goldDeep, bg: WarmPalette.goldSoft,
                       title: "login.feature.events.title", desc: "login.feature.events.desc")
            featureRow(symbol: "person.2.fill", tint: WarmPalette.mint, bg: WarmPalette.mintSoft,
                       title: "login.feature.members.title", desc: "login.feature.members.desc")
        }
    }

    private func featureRow(symbol: String, tint: Color, bg: Color,
                            title: LocalizedStringKey, desc: LocalizedStringKey) -> some View {
        HStack(spacing: Theme.Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: 11, style: .continuous).fill(bg)
                Image(systemName: symbol).font(.system(size: 17, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.Fonts.bodyStrong).foregroundStyle(Theme.Colors.inkPrimary)
                Text(desc).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(Theme.Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
            .stroke(Theme.Colors.line, lineWidth: 1))
    }

    // MARK: - iPad (zweispaltig)

    private var iPadLayout: some View {
        HStack(spacing: 0) {
            // Links: Marke + Vorstellung im warmen Verlauf, Wellenform unten.
            ZStack(alignment: .bottomLeading) {
                WarmPalette.heroGradient
                WaveformStrip(color: .white.opacity(0.5), reduceMotion: reduceMotion)
                    .frame(height: 96).allowsHitTesting(false)
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    brandTile
                    Text("login.title")
                        .font(.system(size: 52, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                    Text("login.subtitle")
                        .font(Theme.Fonts.body).foregroundStyle(.white.opacity(0.92))
                        .frame(maxWidth: 360, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                    VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                        iPadFeatureLine(symbol: "music.note", title: "login.feature.routines.title")
                        iPadFeatureLine(symbol: "trophy.fill", title: "login.feature.events.title")
                        iPadFeatureLine(symbol: "person.2.fill", title: "login.feature.members.title")
                    }
                    .padding(.top, Theme.Spacing.s2)
                }
                .padding(Theme.Spacing.s8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Rechts: Formular, zentriert auf ruhiger Fläche.
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                    authForm
                    if let error = session.loginError { errorCard(error) }
#if DEBUG
                    DevPersonaLogin()
#endif
                }
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
                .padding(Theme.Spacing.s8)
                .frame(maxHeight: .infinity, alignment: .center)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Colors.bgCanvas)
        }
        .ignoresSafeArea()
    }

    private func iPadFeatureLine(symbol: String, title: LocalizedStringKey) -> some View {
        HStack(spacing: Theme.Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous).fill(.white.opacity(0.18))
                Image(systemName: symbol).font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
            }
            .frame(width: 30, height: 30)
            Text(title).font(Theme.Fonts.bodyStrong).foregroundStyle(.white)
        }
    }

    // MARK: - Formular

    private var authForm: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text(isRegistering ? "login.form.registerTitle" : "login.form.signInTitle")
                    .font(Theme.Fonts.bodyStrong).foregroundStyle(Theme.Colors.inkPrimary)

                if isRegistering {
                    labeledField("Name", text: $displayName)
                }
                labeledField("E-Mail", text: $email, isEmail: true)
                labeledSecureField(isRegistering ? "Passwort (min. 8 Zeichen)" : "Passwort")

                Button(action: submit) {
                    HStack(spacing: Theme.Spacing.s2) {
                        if session.isLoggingIn {
                            ProgressView().tint(.white)
                        }
                        Text(isRegistering ? "Konto erstellen" : "Anmelden")
                            .font(Theme.Fonts.bodyStrong)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.s3)
                    .background(canSubmit ? AnyShapeStyle(WarmPalette.heroGradient) : AnyShapeStyle(Theme.Colors.lineStrong))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(session.isLoggingIn || !canSubmit)

                Button {
                    isRegistering.toggle()
                    session.loginError = nil
                } label: {
                    Text(isRegistering ? "Schon ein Konto? Anmelden" : "Neu hier? Konto erstellen")
                        .font(Theme.Fonts.caption).foregroundStyle(WarmPalette.coralDeep)
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

    // MARK: - Feld-Bausteine

    private func labeledField(_ title: String, text: Binding<String>, isEmail: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(verbatim: title).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.inkSoft)
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
            Text(verbatim: title).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.inkSoft)
            SecureField("", text: $password)
                .padding(Theme.Spacing.s3)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    private func errorCard(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.danger).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("login.error.title").font(Theme.Fonts.bodyStrong).foregroundStyle(Theme.Colors.danger)
                Text(verbatim: message).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.dangerSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }
}

/// iOS-spezifische Tastatur-/AutoFill-Feinheiten (E-Mail). Auf macOS ein No-op.
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
