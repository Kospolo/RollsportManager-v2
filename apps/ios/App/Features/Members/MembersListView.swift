import SwiftUI

/// Root-View des Features „Mitglieder" — das VERZEICHNIS des Vereins.
///
/// Web-Referenz: `apps/web/app/(portal)/mitglieder` (Karten statt Tabelle,
/// Rollen- + Sparten-Chips, Gruppierung nach Team). MOBIL GEDACHT, nicht 1:1
/// kopiert: eine Karte pro Reihe statt eines Rasters, die Gruppierung wandert
/// ins Toolbar-Menue (eine dritte Chip-Reihe kostet vertikalen Platz, den es
/// auf dem Telefon nicht gibt), und die Karte traegt ihre Angaben untereinander
/// statt nebeneinander.
struct MembersListView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = MembersViewModel()

    /// Haptik zur Chip-Auswahl. Die App hatte bisher NULL Haptik — ein Filter,
    /// der die Liste umbaut, darf sich im Daumen bemerkbar machen.
    @State private var selectionTick = 0

#if DEBUG
    /// Dev-Automation fuer Smoke-Tests: `-devMemberOpen <member-uuid>` oeffnet
    /// beim Start direkt DIESE Person. Ohne das Argument liesse sich der
    /// Persona-Beweis („was sieht ein Mitglied von einem fremden Menschen")
    /// nur durch blindes Tippen auf Bildschirmkoordinaten fuehren — und der
    /// Beweis waere beim naechsten Layout-Wechsel hinfaellig.
    @State private var devOpenedMemberId: String? = UserDefaults.standard
        .string(forKey: "devMemberOpen")
        .flatMap { $0.isEmpty ? nil : $0 }
#endif

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                loadingView
            case .failed(let message):
                errorView(message)
            case .loaded:
                memberList
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("tab.members"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { groupMenu }
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
#if DEBUG
        .navigationDestination(
            isPresented: Binding(
                get: { devOpenedMemberId != nil && viewModel.state == .loaded },
                set: { if !$0 { devOpenedMemberId = nil } }
            )
        ) {
            if let id = devOpenedMemberId {
                MemberDetailView(memberId: id, viewModel: viewModel)
            }
        }
#endif
    }

    // MARK: - Zustände

    /// Skelett-KARTEN statt Vollbild-Spinner: der Bildschirm zeigt sofort die
    /// Form des Ergebnisses; beim Eintreffen springt das Layout nicht.
    private var loadingView: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.s2) {
                ForEach(0..<8, id: \.self) { _ in MembersSkeletonCard() }
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.vertical, Theme.Spacing.s3)
        }
        .accessibilityLabel(Text("members.loading"))
    }

    /// Fehlerkarte mit Klartext (APIError.errorDescription) + Retry.
    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    VStack(spacing: Theme.Spacing.s2) {
                        Text("members.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "members.error.retry") {
                        // `Task` ist im Modul der Contracts-Struct — daher
                        // voll qualifiziert `_Concurrency.Task`.
                        _Concurrency.Task {
                            await viewModel.load(api: session.api, clubId: session.clubId)
                        }
                    }
                    .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Liste

    private var memberList: some View {
        ScrollView {
            // s2 zwischen den Karten: die Karte traegt Rand UND Schatten, sie
            // grenzt sich also von selbst ab — jeder zusaetzliche Punkt Luft
            // kostet im Verzeichnis unmittelbar Menschen pro Bildschirm.
            LazyVStack(alignment: .leading, spacing: Theme.Spacing.s2, pinnedViews: []) {
                filterBar
                if viewModel.members.isEmpty {
                    emptyClubState
                } else if viewModel.filteredMembers.isEmpty {
                    emptyFilterState
                } else {
                    ForEach(viewModel.memberGroups) { group in
                        if let title = groupTitle(group) {
                            groupHeader(title, count: group.members.count)
                        }
                        ForEach(group.members, id: \.id) { member in
                            memberLink(member)
                        }
                    }
                    listFooter
                }
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.vertical, Theme.Spacing.s3)
        }
        .searchable(
            text: $viewModel.searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: Text("members.search.prompt")
        )
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
        .sensoryFeedback(.selection, trigger: selectionTick)
    }

    private func memberLink(_ member: ClubMember) -> some View {
        NavigationLink {
            MemberDetailView(memberId: member.id, viewModel: viewModel)
        } label: {
            MemberCardView(
                member: member,
                teamNames: viewModel.teamNameList(for: member),
                isSelf: member.id == session.session?.profile.memberId
            )
        }
        // RSMPressableButtonStyle: leichtes Skalieren beim Druck (Token
        // `motion.press`), respektiert Reduce Motion. Vorher gab die Zeile
        // ueberhaupt kein Feedback.
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text("members.row.a11y \(member.membersFullName)"))
    }

    /// Trefferzahl am Ende — beantwortet „habe ich alle?" ohne Kopfzeile.
    private var listFooter: some View {
        Text("members.list.count \(viewModel.filteredMembers.count)")
            .font(Theme.Fonts.caption)
            .monospacedDigit()
            .foregroundStyle(Theme.Colors.inkFaint)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, Theme.Spacing.s2)
            .accessibilityAddTraits(.isSummaryElement)
    }

    private func groupTitle(_ group: MembersViewModel.MemberGroup) -> String? {
        if group.isTeamless { return String(localized: "members.group.teamless") }
        return group.title
    }

    private func groupHeader(_ title: String, count: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Text(verbatim: title)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(verbatim: "\(count)")
                .font(Theme.Fonts.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .padding(.top, Theme.Spacing.s2)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Leer-Zustände
    //
    // ZWEI verschiedene Saetze, weil es zwei verschiedene Lagen sind: „dieser
    // Verein hat noch niemanden" ist eine Tatsache; „deine Filter treffen
    // niemanden" ist ein Bedienzustand mit Ausweg.

    private var emptyClubState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "person.2",
                title: "members.emptyClub.title",
                message: "members.emptyClub.message"
            )
        }
    }

    private var emptyFilterState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "line.3.horizontal.decrease.circle",
                title: "members.empty.title",
                message: "members.empty.message",
                actionTitle: viewModel.hasActiveFilter ? "members.empty.reset" : nil,
                action: viewModel.hasActiveFilter ? { viewModel.resetFilters() } : nil
            )
        }
    }

    // MARK: - Filter

    private var filterBar: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            roleFilterChips
            // Sparten-Reihe NUR, wenn der Verein Sparten hat. Sonst faellt sie
            // ersatzlos weg — ein Filter ohne Auswahl ist verschenkte Hoehe.
            if !viewModel.sparteFilterOptions.isEmpty {
                sparteFilterChips
            }
        }
    }

    private var roleFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(viewModel.roleFilterOptions, id: \.filter.id) { option in
                    MembersCountChip(
                        title: option.filter.labelKey,
                        count: option.count,
                        isSelected: viewModel.roleFilter == option.filter
                    ) {
                        viewModel.roleFilter =
                            viewModel.roleFilter == option.filter ? .all : option.filter
                        selectionTick += 1
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.s4)
        }
        .padding(.horizontal, -Theme.Spacing.s4) // Chips laufen bis an den Rand
        .accessibilityLabel(Text("members.filter.role.a11y"))
    }

    private var sparteFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(viewModel.sparteFilterOptions, id: \.filter) { option in
                    sparteChip(option)
                }
            }
            .padding(.horizontal, Theme.Spacing.s4)
        }
        .padding(.horizontal, -Theme.Spacing.s4)
        .accessibilityLabel(Text("members.filter.sparte.a11y"))
    }

    @ViewBuilder
    private func sparteChip(
        _ option: (filter: MembersViewModel.SparteFilter, name: String?, count: Int)
    ) -> some View {
        let isSelected = viewModel.sparteFilter == option.filter
        let select = {
            viewModel.sparteFilter = isSelected ? .all : option.filter
            selectionTick += 1
        }
        switch option.filter {
        case .all:
            MembersCountChip(
                title: "members.filter.sparte.all",
                count: option.count,
                isSelected: isSelected,
                action: select
            )
        case .none:
            MembersCountChip(
                title: "members.filter.sparte.none",
                count: option.count,
                isSelected: isSelected,
                action: select
            )
        case .sparte:
            // Sparten-Namen kommen aus der API — bewusst kein Katalog-Key.
            MembersCountChip(
                title: LocalizedStringKey(option.name ?? ""),
                count: option.count,
                isSelected: isSelected,
                action: select
            )
        }
    }

    // MARK: - Gruppierung (Toolbar-Menü)

    private var groupMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Picker(selection: $viewModel.groupMode) {
                    Text("members.group.none").tag(MembersViewModel.GroupMode.none)
                    Text("members.group.team").tag(MembersViewModel.GroupMode.team)
                } label: {
                    Text("members.group.label")
                }
            } label: {
                Image(systemName: viewModel.groupMode == .team
                    ? "rectangle.3.group.fill"
                    : "rectangle.3.group")
            }
            // Ohne Teams gibt es nichts zu gruppieren — der Schalter waere
            // eine Luege ueber die Datenlage.
            .disabled(viewModel.teams.isEmpty)
            .accessibilityLabel(Text("members.group.label"))
        }
    }
}
