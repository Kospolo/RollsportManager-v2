import SwiftUI

// ============================================================================
// Verwaltung › Module — welche Bereiche der Verein nutzt.
//
// Web-Referenz: die Modul-Verwaltung im Verwaltungsbereich. Gegenstück zur
// bereits gebauten `RSMModuleNotBookedCard`: DORT erfährt ein Mitglied, dass
// ein Bereich nicht gebucht ist — HIER legt die Vereinsleitung den Schalter um.
// Ohne diesen Screen wäre die Karte ein Hinweis auf einen Knopf, den es in der
// App gar nicht gibt.
//
// ### DREI ZUSTÄNDE, DIE MAN NICHT VERWECHSELN DARF ###
//   Kernmodul       — immer an, kein Schalter (Mitglieder, Finanzen,
//                     Verwaltung; Aufbewahrungspflicht).
//   PRO nicht gebucht — Schalter an, Modul trotzdem nicht verfügbar. Das ist
//                     kein Widerspruch: der Verein WILL es, die Lizenz fehlt.
//   Aus             — der Verein nutzt es nicht.
// ============================================================================

struct ModuleAdminView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = ModuleAdminViewModel()

    /// Schalten darf nur die Vereinsleitung (is_club_admin). Der Server
    /// entscheidet verbindlich — das hier ist ehrliche Menüführung.
    private var canManage: Bool { session.permissions.isClubAdmin }

    var body: some View {
        ScrollView {
            content
                .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("modules.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await model.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .refreshable { await model.load(api: session.api, clubId: session.clubId) }
        .alert(
            "modules.error.title",
            isPresented: Binding(
                get: { model.actionError != nil },
                set: { if !$0 { model.actionError = nil } }
            ),
            presenting: model.actionError
        ) { _ in
            Button("routines.common.ok", role: .cancel) {}
        } message: { message in
            Text(verbatim: message)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView()
                .tint(Theme.Colors.brand)
                .frame(maxWidth: .infinity)
                .padding(.top, Theme.Spacing.s9)
        case .forbidden:
            RSMEmptyState(
                systemImage: "lock.fill",
                title: "modules.denied.title",
                message: "modules.denied.message"
            )
            .padding(.top, Theme.Spacing.s7)
        case .failed(let message):
            PlatformErrorCard(message: message) {
                _Concurrency.Task { await model.load(api: session.api, clubId: session.clubId) }
            }
        case .loaded:
            loaded
        }
    }

    private var loaded: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
            intro
            if !model.switchable.isEmpty {
                section(
                    eyebrow: "modules.section.optional.eyebrow",
                    title: "modules.section.optional.title",
                    modules: model.switchable,
                    showsSwitch: true
                )
            }
            if !model.core.isEmpty {
                section(
                    eyebrow: "modules.section.core.eyebrow",
                    title: "modules.section.core.title",
                    modules: model.core,
                    showsSwitch: false
                )
            }
        }
    }

    private var intro: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text(canManage ? "modules.intro.admin" : "modules.intro.readOnly")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func section(
        eyebrow: LocalizedStringKey,
        title: LocalizedStringKey,
        modules: [ClubModuleState],
        showsSwitch: Bool
    ) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: eyebrow, title: title)
                VStack(spacing: 0) {
                    ForEach(Array(modules.enumerated()), id: \.element.moduleKey) { index, module in
                        row(module, showsSwitch: showsSwitch)
                        if index < modules.count - 1 {
                            Divider().overlay(Theme.Colors.line)
                        }
                    }
                }
            }
        }
    }

    private func row(_ module: ClubModuleState, showsSwitch: Bool) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: ModuleAdminViewModel.label(module))
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(verbatim: ModuleAdminViewModel.desc(module))
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Theme.Spacing.s2)
                if showsSwitch {
                    toggle(module)
                } else {
                    RSMStatusPill(text: "modules.pill.alwaysOn", kind: .success)
                }
            }
            badges(module)
        }
        .padding(.vertical, Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.listRow)
    }

    @ViewBuilder
    private func toggle(_ module: ClubModuleState) -> some View {
        if model.pending.contains(module.moduleKey) {
            ProgressView()
                .tint(Theme.Colors.brand)
                .frame(width: 51, height: Theme.Size.touchTarget)
        } else {
            Toggle(
                isOn: Binding(
                    get: { module.enabled },
                    set: { newValue in
                        _Concurrency.Task {
                            await model.setEnabled(
                                newValue,
                                module: module,
                                api: session.api,
                                clubId: session.clubId
                            )
                        }
                    }
                )
            ) {
                // Der sichtbare Text steht links in der Zeile; VoiceOver
                // braucht den Namen trotzdem AM Schalter, sonst heisst er nur
                // „Ein/Aus".
                Text(verbatim: ModuleAdminViewModel.label(module))
            }
            .labelsHidden()
            .tint(Theme.Colors.brand)
            .disabled(!canManage)
            .accessibilityLabel(Text(verbatim: ModuleAdminViewModel.label(module)))
        }
    }

    /// Die ehrlichen Nebenzustände: PRO-Pflicht und „eingeschaltet, aber die
    /// Lizenz fehlt". Ohne den zweiten Chip wirkt ein aktiver Schalter neben
    /// einem leeren Bereich wie ein Defekt.
    @ViewBuilder
    private func badges(_ module: ClubModuleState) -> some View {
        let showsProGap = module.requiresPro && module.enabled && !module.proOk
        if module.requiresPro || showsProGap {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Theme.Spacing.s2) { badgeContent(module, showsProGap: showsProGap) }
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    badgeContent(module, showsProGap: showsProGap)
                }
            }
        }
    }

    @ViewBuilder
    private func badgeContent(_ module: ClubModuleState, showsProGap: Bool) -> some View {
        if module.requiresPro {
            RSMStatusPill(text: "modules.pill.pro", kind: .honey)
        }
        if showsProGap {
            RSMStatusPill(text: "modules.pill.proMissing", kind: .warn)
        }
    }
}
