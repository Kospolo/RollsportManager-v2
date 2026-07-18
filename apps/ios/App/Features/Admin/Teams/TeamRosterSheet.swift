import Foundation
import SwiftUI

/// Kader-Editor (Sheet): jede Person bekommt eine Team-Rolle
/// (Kein / Trainer / Sportler). Beim Speichern geht der VOLLE Satz an
/// `setTeamMembers` (VOLL-Replace) — nicht gewählte Personen werden
/// serverseitig aus dem Team entfernt. Erfolg: aktualisiertes `Team` via
/// `onSaved`, Sheet schließt; 403 als Alert. Web-Referenz: teams/RosterDialog.tsx.
struct TeamRosterSheet: View {
    @StateObject private var model: TeamRosterViewModel
    @Environment(\.dismiss) private var dismiss
    private let teamName: String

    init(
        team: Team,
        members: [ClubMember],
        initialRoles: [String: AdminTeamRole],
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Team) -> Void
    ) {
        self.teamName = team.name
        _model = StateObject(wrappedValue: TeamRosterViewModel(
            team: team,
            members: members,
            roles: initialRoles,
            api: api,
            clubId: clubId,
            onSaved: onSaved
        ))
    }

    var body: some View {
        NavigationStack {
            content
                .background(Theme.Colors.bgCanvas.ignoresSafeArea())
                .navigationTitle(Text(verbatim: teamName))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("teams.form.cancel") { dismiss() }
                            .tint(Theme.Colors.inkSoft)
                    }
                }
                .alert("teams.error.title", isPresented: submitErrorBinding) {
                    Button("teams.error.ok", role: .cancel) {}
                } message: {
                    Text(verbatim: model.submitError ?? "")
                }
        }
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private var content: some View {
        if model.members.isEmpty {
            ScrollView {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "person.2.slash",
                        title: "teams.roster.title",
                        message: "teams.roster.empty.members"
                    )
                }
                .padding(Theme.Spacing.s5)
            }
        } else {
            VStack(spacing: 0) {
                headerBlock
                memberList
                saveBar
            }
        }
    }

    // MARK: - Kopf (Hinweis · Suche · Zusammenfassung)

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text("teams.roster.hint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)

            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Colors.inkFaint)
                TextField("teams.roster.search.placeholder", text: $model.query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .accessibilityLabel(Text("teams.roster.search.a11y"))
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())

            HStack(spacing: Theme.Spacing.s2) {
                Text("teams.card.coaches \(model.coachCount)")
                Text(verbatim: "·")
                Text("teams.card.skaters \(model.skaterCount)")
            }
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(Theme.Colors.inkSoft)
            .accessibilityElement(children: .combine)
        }
        .padding(.horizontal, Theme.Spacing.s5)
        .padding(.top, Theme.Spacing.s4)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var memberList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(model.filteredMembers, id: \.id) { member in
                    MemberRosterRow(
                        member: member,
                        role: model.role(for: member.id),
                        onChange: { model.setRole(member.id, $0) }
                    )
                    Divider().background(Theme.Colors.line)
                }
                if model.filteredMembers.isEmpty {
                    Text("teams.roster.search.empty")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkFaint)
                        .padding(Theme.Spacing.s6)
                }
            }
            .padding(.horizontal, Theme.Spacing.s5)
        }
    }

    private var saveBar: some View {
        RSMPrimaryButton(title: "teams.roster.save", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.save() { dismiss() }
            }
        }
        .padding(Theme.Spacing.s5)
        .background(Theme.Colors.bgSurface.ignoresSafeArea(edges: .bottom))
    }

    private var submitErrorBinding: Binding<Bool> {
        Binding(
            get: { model.submitError != nil },
            set: { if !$0 { model.submitError = nil } }
        )
    }
}

/// Eine Personen-Zeile mit Avatar, Name/Kontext und Rollen-Segment.
private struct MemberRosterRow: View {
    let member: ClubMember
    let role: AdminTeamRole
    let onChange: (AdminTeamRole) -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: AdminTeamsViewModel.fullName(member), personId: member.id, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: AdminTeamsViewModel.fullName(member))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                if let subtitle {
                    Text(verbatim: subtitle)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Theme.Spacing.s2)
            RoleSegment(role: role, onChange: onChange)
        }
        .padding(.vertical, Theme.Spacing.s3)
    }

    private var subtitle: String? {
        if let email = member.email, !email.isEmpty { return email }
        if let birth = member.birthDate, birth.count >= 4 { return String(birth.prefix(4)) }
        return nil
    }
}

/// Drei-Segment-Umschalter Kein / Trainer / Sportler.
private struct RoleSegment: View {
    let role: AdminTeamRole
    let onChange: (AdminTeamRole) -> Void

    private let options: [(AdminTeamRole, LocalizedStringKey)] = [
        (.none, "teams.roster.role.none"),
        (.coach, "teams.roster.role.coach"),
        (.skater, "teams.roster.role.skater"),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { option in
                let active = role == option.0
                Button {
                    onChange(option.0)
                } label: {
                    Text(option.1)
                        .font(Theme.Fonts.caption.weight(.bold))
                        .foregroundStyle(active ? activeForeground(option.0) : Theme.Colors.inkFaint)
                        .padding(.horizontal, Theme.Spacing.s3)
                        .frame(minHeight: 34)
                        .background(active ? activeBackground(option.0) : Color.clear)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? [.isSelected] : [])
            }
        }
        .background(Theme.Colors.bgSunken)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Theme.Colors.line, lineWidth: 1))
    }

    private func activeBackground(_ role: AdminTeamRole) -> Color {
        switch role {
        case .none: Theme.Colors.bgSurface
        case .coach: Theme.Colors.successSoft
        case .skater: Theme.Colors.infoSoft
        }
    }

    private func activeForeground(_ role: AdminTeamRole) -> Color {
        switch role {
        case .none: Theme.Colors.inkPrimary
        case .coach: Theme.Colors.success
        case .skater: Theme.Colors.info
        }
    }
}

// MARK: - ViewModel

@MainActor
final class TeamRosterViewModel: ObservableObject {

    @Published var query = ""
    @Published private(set) var roles: [String: AdminTeamRole]
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    let members: [ClubMember]
    private let team: Team
    private let api: APIClient
    private let clubId: String
    private let onSaved: (Team) -> Void

    init(
        team: Team,
        members: [ClubMember],
        roles: [String: AdminTeamRole],
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Team) -> Void
    ) {
        self.team = team
        self.members = members
        self.roles = roles
        self.api = api
        self.clubId = clubId
        self.onSaved = onSaved
    }

    func role(for memberId: String) -> AdminTeamRole { roles[memberId] ?? .none }

    func setRole(_ memberId: String, _ role: AdminTeamRole) {
        if role == .none { roles[memberId] = nil } else { roles[memberId] = role }
    }

    var coachCount: Int { roles.values.filter { $0 == .coach }.count }
    var skaterCount: Int { roles.values.filter { $0 == .skater }.count }

    var filteredMembers: [ClubMember] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return members }
        return members.filter { AdminTeamsViewModel.fullName($0).lowercased().contains(needle) }
    }

    /// VOLL-Replace an den Server. Erfolg → `true` (Sheet schließt); 403/
    /// Transportfehler → `false` (Alert, Sheet bleibt offen).
    func save() async -> Bool {
        guard !isSaving else { return false }
        let coachIds = roles.compactMap { $0.value == .coach ? $0.key : nil }
        let skaterIds = roles.compactMap { $0.value == .skater ? $0.key : nil }

        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await api.setTeamMembers(
                clubId: clubId,
                teamId: team.id,
                TeamMembersSet(skaterMemberIds: skaterIds, coachMemberIds: coachIds)
            )
            onSaved(updated)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("teams.error.forbidden", comment: "403 beim Kader-Speichern")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}
