import SwiftUI

/// Root-View des Features „Profil & Einstellungen“ (Web-Referenz:
/// /(portal)/profil + /(portal)/einstellungen — im nativen Client zu EINEM
/// Screen zusammengeführt, da „Profil“ genau ein Ziel im „Mehr“-Hub ist).
///
/// Aufbau (von oben): Kopf (Avatar/Name/Rolle/Verein) · Bearbeiten (eigenes
/// Profil) · Konto (Anmelde-E-Mail, nur lesend) · Darstellung (Sprache/Theme) ·
/// Benachrichtigungen · Abmelden. Läuft im NavigationStack des „Mehr“-Hubs
/// (kein eigener Stack) — angehängt über `ProfileRootView`.
struct ProfileView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = ProfileViewModel()
    /// Öffentliches Selbst-Profil (Motto/Disziplin/„seit wann" + Sichtbarkeit).
    /// Eigenes ViewModel, weil es an einem ANDEREN Endpunkt hängt
    /// (club-/mitglieds-gebunden) als die Stammdaten (`/me`).
    @StateObject private var selfProfile = ProfileSelfViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                loadingView
            case .failed(let message):
                errorView(message)
            case .loaded:
                content
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("module.profile.title"))
        .navigationBarTitleDisplayMode(.large)
        .preferredColorScheme(viewModel.themeColorScheme)
        .task {
            await viewModel.loadIfNeeded(api: session.api)
            await selfProfile.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                memberId: session.session?.profile.memberId
            )
#if DEBUG
            await applySelfProfileDevHook()
#endif
        }
        .alert("profil.error.saveTitle", isPresented: saveErrorBinding) {
            Button("profil.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: viewModel.profileSaveError ?? "")
        }
        .alert("profil.settings.saveErrorTitle", isPresented: settingsErrorBinding) {
            Button("profil.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: viewModel.settingsError ?? "")
        }
        .alert("profil.self.saveErrorTitle", isPresented: selfErrorBinding) {
            Button("profil.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: selfProfile.saveError ?? "")
        }
        .onChange(of: viewModel.profileSaved) { autoHideSavedConfirmation() }
        .onChange(of: selfProfile.saved) { autoHideSelfSavedConfirmation() }
    }

    // MARK: - Inhalt

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.cardGap) {
                ProfileHeaderCard(
                    displayName: viewModel.displayName,
                    membership: viewModel.primaryMembership,
                    photoKey: viewModel.photoKey
                )

                if viewModel.primaryMembership != nil {
                    // „Dein Bild" steht VOR den Stammdaten: es ist das erste,
                    // was andere von einem sehen — und war bisher gar nicht
                    // setzbar (Befund am iPhone).
                    ProfilePhotoCard(
                        viewModel: viewModel,
                        displayName: viewModel.displayName,
                        personId: viewModel.primaryMembership?.id,
                        onPick: { data in
                            _Concurrency.Task { await viewModel.setPhoto(data: data, api: session.api) }
                        },
                        onRemove: {
                            _Concurrency.Task { await viewModel.removePhoto(api: session.api) }
                        }
                    )
                    ProfileEditCard(viewModel: viewModel) {
                        _Concurrency.Task { await viewModel.saveProfile(api: session.api) }
                    }
                    ProfileSelfCard(viewModel: selfProfile) {
                        _Concurrency.Task { await selfProfile.save(api: session.api) }
                    }
                } else {
                    noMembershipCard
                }

                ProfileAccountCard(email: viewModel.accountEmail)

                ProfileAppearanceCard(
                    viewModel: viewModel,
                    onChooseLocale: { code in
                        _Concurrency.Task { await viewModel.chooseLocale(code, api: session.api) }
                    },
                    onChooseTheme: { theme in
                        _Concurrency.Task { await viewModel.chooseTheme(theme, api: session.api) }
                    }
                )

                ProfileNotificationsCard(viewModel: viewModel) { kind, value in
                    _Concurrency.Task { await viewModel.setNotif(kind, value, api: session.api) }
                }

                signOutButton
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable {
            await viewModel.load(api: session.api)
            await selfProfile.load()
        }
    }

    private var noMembershipCard: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "person.crop.circle.badge.questionmark",
                title: "profil.noMembership.title",
                message: "profil.noMembership.message"
            )
        }
    }

    private var signOutButton: some View {
        Button(role: .destructive) {
            session.logout()
        } label: {
            Label("common.logout", systemImage: "rectangle.portrait.and.arrow.right")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.danger)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .background(Theme.Colors.dangerSoft)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text("common.logout"))
    }

    // MARK: - Lade-/Fehlerzustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("profil.loading")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    VStack(spacing: Theme.Spacing.s2) {
                        Text("profil.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "profil.error.retry") {
                        _Concurrency.Task { await viewModel.load(api: session.api) }
                    }
                    .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Bindings + Effekte

    private var saveErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.profileSaveError != nil },
            set: { if !$0 { viewModel.profileSaveError = nil } }
        )
    }

    private var selfErrorBinding: Binding<Bool> {
        Binding(
            get: { selfProfile.saveError != nil },
            set: { if !$0 { selfProfile.saveError = nil } }
        )
    }

    private var settingsErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.settingsError != nil },
            set: { if !$0 { viewModel.settingsError = nil } }
        )
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: `-devSelfProfileMotto "<Text>"` (optional
    /// `-devSelfProfileVisibility public|internal`) füllt das Selbst-Profil-
    /// Formular und löst GENAU denselben Speicher-Pfad aus wie die Schaltfläche
    /// „Angaben speichern". Ohne Argument passiert nichts.
    private func applySelfProfileDevHook() async {
        let defaults = UserDefaults.standard
        guard let motto = defaults.string(forKey: "devSelfProfileMotto") else { return }
        selfProfile.motto = motto
        if let raw = defaults.string(forKey: "devSelfProfileVisibility"),
           let visibility = ProfileVisibility(rawValue: raw) {
            selfProfile.visibility = visibility
        }
        if let discipline = defaults.string(forKey: "devSelfProfileDiscipline") {
            selfProfile.discipline = discipline
        }
        await selfProfile.save(api: session.api)
    }
#endif

    /// Erfolgs-Bestätigung des Selbst-Profils nach kurzer Zeit ausblenden.
    private func autoHideSelfSavedConfirmation() {
        guard selfProfile.saved else { return }
        _Concurrency.Task {
            try? await _Concurrency.Task.sleep(nanoseconds: 2_400_000_000)
            withAnimation(.easeOut(duration: Theme.Motion.standard)) {
                selfProfile.saved = false
            }
        }
    }

    /// Erfolgs-Bestätigung nach kurzer Zeit wieder ausblenden.
    private func autoHideSavedConfirmation() {
        guard viewModel.profileSaved else { return }
        _Concurrency.Task {
            try? await _Concurrency.Task.sleep(nanoseconds: 2_400_000_000)
            withAnimation(.easeOut(duration: Theme.Motion.standard)) {
                viewModel.profileSaved = false
            }
        }
    }
}
