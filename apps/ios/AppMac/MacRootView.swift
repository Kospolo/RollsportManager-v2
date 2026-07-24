#if os(macOS)
import SwiftUI

/// Auswahl-Zustand EINES Fensters.
///
/// Bewusst pro Fenster (nicht app-weit): Auf dem Mac darf ⌘N ein zweites
/// Fenster öffnen, in dem jemand die Mitgliederliste offen lässt, während er
/// im ersten die Finanzen durchgeht. Ein geteilter Zustand würde beide Fenster
/// aneinanderketten — das wäre iOS-Denken in einem Mac-Fenster.
@MainActor
final class MacNavigationModel: ObservableObject {
    @Published var selection: String? = MacSidebarCatalog.defaultItemID

    /// Springt zum Eintrag, wenn es ihn in der aktuellen Seitenleiste gibt.
    func select(_ id: String, in sections: [MacSidebarSection]) {
        guard sections.contains(where: { $0.items.contains { $0.id == id } }) else { return }
        selection = id
    }
}

/// Focused-Value, damit die Menübefehle das Fenster treffen, das gerade vorn
/// ist — und nicht irgendeines.
struct MacNavigationFocusKey: FocusedValueKey {
    typealias Value = MacNavigationModel
}

extension FocusedValues {
    var macNavigation: MacNavigationModel? {
        get { self[MacNavigationFocusKey.self] }
        set { self[MacNavigationFocusKey.self] = newValue }
    }
}

/// Mac-Wurzel: Seitenleiste statt Tab-Leiste.
///
/// Die iOS-App hat fünf Tabs und schiebt alles Weitere in den „Mehr“-Hub —
/// eine Notlösung für die 5-Tab-Grenze (siehe `MainTabView`). Auf dem Mac gibt
/// es diese Grenze nicht: Hier stehen ALLE Bereiche gleichberechtigt in der
/// Seitenleiste, gruppiert. Der „Mehr“-Hub entfällt damit ersatzlos — er wäre
/// auf dem Mac ein Umweg um ein Problem, das es hier nicht gibt.
struct MacRootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var nav = MacNavigationModel()
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    /// Der Bereich, der im Detailbereich WIRKLICH steht.
    ///
    /// Warum nicht einfach `nav.selection`? Weil die Auswahl einer
    /// `List(selection:)` beim Fensteraufbau kurz auf `nil` fällt und sofort
    /// zurückspringt. Hinge der Detailbereich direkt daran, würde er in diesem
    /// Moment abgeräumt und neu gebaut — und damit die Übersicht ZWEIMAL laden.
    /// Genau das war messbar: gegen den eigenen Harness kamen `/members`,
    /// `/invoices`, `/competitions` und `/tasks` doppelt an, während dieselbe
    /// Persona auf iOS jeden Aufruf genau einmal machte. Diese Zwischenstufe
    /// nimmt nur GÜLTIGE Auswahlen an; ein `nil`-Zucken lässt sie stehen.
    @State private var shownItemID = MacSidebarCatalog.defaultItemID

    private var sections: [MacSidebarSection] {
        MacSidebarCatalog.sections(
            isClubAdmin: session.permissions.isClubAdmin,
            isPlatformAdmin: session.permissions.isPlatformAdmin
        )
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            sidebar
                .navigationSplitViewColumnWidth(min: 208, ideal: 236, max: 320)
        } detail: {
            detail
        }
        .navigationSplitViewStyle(.balanced)
        .frame(minWidth: 940, minHeight: 620)
        .focusedSceneValue(\.macNavigation, nav)
        .onAppear { ensureValidSelection() }
        .onChange(of: session.permissions.role) { _, _ in ensureValidSelection() }
        .onChange(of: nav.selection) { _, new in
            guard let new, new != shownItemID else { return }
            shownItemID = new
        }
    }

    // MARK: - Seitenleiste

    private var sidebar: some View {
        List(selection: $nav.selection) {
            Section {
                // Kein Ziel, also auch nicht auswählbar — sonst könnte ein
                // Klick darauf den Detailbereich leeren.
                MacAccountRow()
                    .selectionDisabled()
            }
            ForEach(sections) { section in
                Section {
                    ForEach(section.items) { item in
                        row(item)
                    }
                } header: {
                    Text(section.titleKey)
                        .font(Theme.Fonts.eyebrow)
                        .tracking(Theme.Fonts.eyebrowTracking)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle(Text("app.name"))
    }

    private func row(_ item: MacSidebarItem) -> some View {
        Label {
            Text(item.titleKey)
                .font(Theme.Fonts.body)
        } icon: {
            Image(systemName: item.systemImage)
                .foregroundStyle(item.tone.foreground)
        }
        .tag(item.id)
    }

    // Die Tastenkürzel ⌘1 … ⌘5 hängen BEWUSST am Menü (`MacCommands`), nicht
    // an diesen Zeilen: `keyboardShortcut` auf einer Listenzeile ohne Button
    // bliebe wirkungslos, und auf dem Mac gehört ein Kürzel ohnehin dorthin,
    // wo man es nachschlagen kann — in die Menüleiste.

    // MARK: - Detail

    @ViewBuilder
    private var detail: some View {
        if let item = item(for: shownItemID) {
            // Eigener Stack je Bereich: Ein Bereichswechsel darf keinen
            // halb aufgeklappten Detail-Pfad des vorigen Bereichs erben.
            NavigationStack {
                item.destination
            }
            .id(item.id)
        } else {
            MacEmptyDetailView()
        }
    }

    private func item(for id: String) -> MacSidebarItem? {
        for section in sections {
            if let hit = section.items.first(where: { $0.id == id }) { return hit }
        }
        return nil
    }

    /// Wenn sich die Rechte ändern (Anmeldung, Rollenwechsel), kann der zuletzt
    /// gewählte Bereich verschwinden — dann zurück auf die Übersicht statt in
    /// einen leeren Detailbereich.
    private func ensureValidSelection() {
        if let id = nav.selection, item(for: id) != nil {
            shownItemID = id
            return
        }
        let fallback = sections.first?.items.first?.id ?? MacSidebarCatalog.defaultItemID
        nav.selection = fallback
        shownItemID = fallback
    }
}

/// Kopfzeile der Seitenleiste: wer ist angemeldet — und mit welcher Rolle.
/// Identität über Monogramm + Farbton (`RSMAvatarView`), nie über ein Foto.
private struct MacAccountRow: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(
                name: session.session?.profile.displayName ?? "",
                personId: session.session?.profile.memberId ?? session.session?.persona ?? "",
                size: 30
            )
            VStack(alignment: .leading, spacing: 1) {
                Text(session.session?.profile.displayName ?? "")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                Text(roleLabel)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, Theme.Spacing.s1)
        .accessibilityElement(children: .combine)
    }

    private var roleLabel: String {
        if session.permissions.isPlatformAdmin {
            return String(localized: "mac.account.platformAdmin")
        }
        return session.session?.profile.clubRole?.rawValue ?? ""
    }
}

/// Wird nur sichtbar, wenn es (noch) keinen wählbaren Bereich gibt.
private struct MacEmptyDetailView: View {
    var body: some View {
        VStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "sidebar.left")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.Colors.inkFaint)
            Text("mac.detail.empty.title")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text("mac.detail.empty.message")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.bgCanvas)
    }
}
#endif
