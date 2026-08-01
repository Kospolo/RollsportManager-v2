import SwiftUI

/// Onboarding fuer angemeldete Konten OHNE Verein: gruenden oder per Code
/// beitreten. Wird von RollsportManagerApp gezeigt, wenn `needsClubOnboarding`.
/// Ein Plattform-Admin sieht das NIE (der geht in die Betreiber-Konsole).
struct NoClubOnboardingView: View {
    @EnvironmentObject private var session: SessionStore

    private enum Mode: String, CaseIterable { case create, join }
    @State private var mode: Mode = .create

    // Gründen
    @State private var name = ""
    @State private var city = ""
    // Beitreten
    @State private var code = ""
    @State private var firstName = ""
    @State private var lastName = ""
    // Gemeinsam
    @State private var consent = false

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !city.trimmingCharacters(in: .whitespaces).isEmpty && consent
    }
    private var canJoin: Bool {
        code.trimmingCharacters(in: .whitespaces).count >= 4
            && !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty && consent
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                header
                if session.joinPending {
                    pendingCard
                } else {
                    modePicker
                    RSMCard(padding: Theme.Spacing.s4) {
                        if mode == .create { createForm } else { joinForm }
                    }
                }
                if let error = session.loginError {
                    Text(error)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.danger)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Theme.Spacing.s4)
                        .background(Theme.Colors.dangerSoft)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
                }
                Button("Abmelden") { session.logout() }
                    .buttonStyle(.plain)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .animation(.easeOut(duration: Theme.Motion.standard), value: mode)
        .animation(.easeOut(duration: Theme.Motion.standard), value: session.joinPending)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("WILLKOMMEN")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .foregroundStyle(Theme.Colors.brandInk)
            Text("Noch kein Verein")
                .font(Theme.Fonts.display)
                .tracking(Theme.Fonts.displayTracking)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text("Gründe deinen Verein oder tritt einem bestehenden mit dem Vereinscode bei.")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .padding(.top, Theme.Spacing.s6)
    }

    private var modePicker: some View {
        Picker("", selection: $mode) {
            Text("Verein gründen").tag(Mode.create)
            Text("Beitreten").tag(Mode.join)
        }
        .pickerStyle(.segmented)
    }

    private var createForm: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            field("Vereinsname", text: $name)
            field("Ort", text: $city)
            consentToggle
            submitButton("Verein gründen", enabled: canCreate) {
                await session.createClub(name: name, city: city)
            }
        }
    }

    private var joinForm: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            field("Vereinscode", text: $code)
            field("Vorname", text: $firstName)
            field("Nachname", text: $lastName)
            consentToggle
            submitButton("Beitritt beantragen", enabled: canJoin) {
                await session.joinClub(code: code, firstName: firstName, lastName: lastName)
            }
        }
    }

    private var consentToggle: some View {
        Toggle(isOn: $consent) {
            Text("Ich stimme den Nutzungsbedingungen und der Datenschutzerklärung zu.")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .tint(Theme.Colors.brand)
    }

    private var pendingCard: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("Antrag gestellt")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text("Dein Beitrittsantrag wurde übermittelt. Ein Vereins-Admin muss dich noch freischalten — danach findest du deinen Verein hier.")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private func field(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(title).font(Theme.Fonts.caption).foregroundStyle(Theme.Colors.inkSoft)
            TextField("", text: text)
                .autocorrectionDisabled()
                .padding(Theme.Spacing.s3)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    private func submitButton(_ title: String, enabled: Bool, _ action: @escaping () async -> Void) -> some View {
        Button {
            _Concurrency.Task { await action() }
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                if session.isLoggingIn { ProgressView().tint(Theme.Colors.brandContrast) }
                Text(title).font(Theme.Fonts.bodyStrong)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.s3)
            .background(enabled ? Theme.Colors.brand : Theme.Colors.lineStrong)
            .foregroundStyle(Theme.Colors.brandContrast)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled || session.isLoggingIn)
    }
}
