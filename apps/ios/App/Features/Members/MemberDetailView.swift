import SwiftUI

/// Detailansicht eines Mitglieds: Stammdaten · Familie · Rolle.
///
/// Der Rollenwechsel (PATCH …/role) läuft optimistisch mit Rollback:
/// 403 → Alert „Keine Berechtigung“, alles andere → Klartext-Alert.
/// Die Familien-Sektion zeigt, was die API liefert — RLS-bedingt sehen
/// Nicht-Vorstände nur die eigene Familie (der EmptyState erklärt das).
struct MemberDetailView: View {
    let memberId: String
    @ObservedObject var viewModel: MembersViewModel
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        ScrollView {
            if let member = viewModel.member(id: memberId) {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    headerCard(member)
                    masterDataCard(member)
                    MemberSpartenCard(memberId: member.id, memberName: member.membersFullName)
                    familyCard(member)
                    if viewerIsBoard { roleCard(member) }
                }
                .padding(Theme.Spacing.s5)
            } else {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "person.crop.circle.badge.questionmark",
                        title: "members.empty.title",
                        message: "members.empty.message"
                    )
                }
                .padding(Theme.Spacing.s5)
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(verbatim: viewModel.member(id: memberId)?.membersFullName ?? ""))
        .navigationBarTitleDisplayMode(.inline)
        .alert(
            alertTitleKey,
            isPresented: Binding(
                get: { viewModel.roleChangeFailure != nil },
                set: { if !$0 { viewModel.roleChangeFailure = nil } }
            ),
            presenting: viewModel.roleChangeFailure
        ) { _ in
            Button("members.alert.ok", role: .cancel) {}
        } message: { failure in
            switch failure {
            case .forbidden:
                Text("members.roleChange.forbidden.message")
            case .other(let message):
                Text(verbatim: message)
            }
        }
    }

    // MARK: - Sichtbarkeiten

    /// Vorstand/Admin dürfen Rollen ändern — alle anderen sehen die Karte nicht.
    private var viewerIsBoard: Bool {
        let role = session.session?.profile.clubRole
        return role == .owner || role == .admin
    }

    /// „Nie sich selbst“ (API-Regel) — für die eigene Person nur ein Hinweis.
    private func isSelf(_ member: ClubMember) -> Bool {
        session.session?.profile.memberId == member.id
    }

    private var alertTitleKey: LocalizedStringKey {
        if case .forbidden = viewModel.roleChangeFailure {
            return "members.roleChange.forbidden.title"
        }
        return "members.roleChange.error.title"
    }

    // MARK: - Kopf

    private func headerCard(_ member: ClubMember) -> some View {
        RSMCard {
            HStack(spacing: Theme.Spacing.s4) {
                RSMAvatarView(name: member.membersFullName, personId: member.id, size: 56)
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    Text(verbatim: member.membersFullName)
                        .font(Theme.Fonts.h2)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    HStack(spacing: Theme.Spacing.s2) {
                        RSMStatusPill(
                            text: MembersL10n.roleKey(member.role),
                            kind: MembersL10n.roleKind(member.role)
                        )
                        RSMStatusPill(
                            text: MembersL10n.statusKey(member.status),
                            kind: MembersL10n.statusKind(member.status)
                        )
                        if let feeStatus = viewModel.feeStatus(for: member) {
                            MembersFeePill(status: feeStatus)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    // MARK: - Stammdaten

    private func masterDataCard(_ member: ClubMember) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.detail.master.eyebrow",
                    title: "members.detail.master.title"
                )
                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    MembersDetailRow(
                        label: "members.detail.email",
                        value: optionalText(member.email)
                    )
                    MembersDetailRow(
                        label: "members.detail.birthDate",
                        value: optionalText(member.birthDate.map(MembersFormat.day))
                    )
                    MembersDetailRow(
                        label: "members.detail.joinedOn",
                        value: optionalText(member.joinedOn.map(MembersFormat.day))
                    )
                    MembersDetailRow(
                        label: "members.detail.teams",
                        value: viewModel.teamNames(for: member).map { Text(verbatim: $0) }
                            ?? Text("members.row.noTeam")
                    )
                }
            }
        }
    }

    private func optionalText(_ value: String?) -> Text {
        value.map { Text(verbatim: $0) } ?? Text("members.detail.none")
    }

    // MARK: - Familie

    private func familyCard(_ member: ClubMember) -> some View {
        let links = viewModel.familyLinks(of: member)
        return RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.detail.family.eyebrow",
                    title: "members.detail.family.title"
                )
                if links.isEmpty {
                    RSMEmptyState(
                        systemImage: "figure.2.and.child.holdinghands",
                        title: "members.family.empty.title",
                        message: viewerIsBoard
                            ? "members.family.emptyAdmin.message"
                            : "members.family.emptyOwn.message"
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(links) { link in
                            familyRow(link)
                            if link.id != links.last?.id {
                                Divider().overlay(Theme.Colors.line)
                            }
                        }
                    }
                }
            }
        }
    }

    private func familyRow(_ link: MembersViewModel.FamilyLink) -> some View {
        NavigationLink {
            MemberDetailView(memberId: link.other.id, viewModel: viewModel)
        } label: {
            HStack(spacing: Theme.Spacing.s3) {
                RSMAvatarView(name: link.other.membersFullName, personId: link.other.id, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: link.other.membersFullName)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    // Beziehungscode gehört zur erziehungsberechtigten Seite.
                    if link.otherIs == .guardian {
                        MembersL10n.relationText(link.relation)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                }
                Spacer(minLength: Theme.Spacing.s2)
                RSMStatusPill(
                    text: link.otherIs == .child
                        ? "members.family.childPill"
                        : "members.family.guardianPill",
                    kind: .info
                )
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: Theme.Size.listRow)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("members.row.a11y \(link.other.membersFullName)"))
    }

    // MARK: - Rolle ändern (nur Vorstand/Admin)

    private func roleCard(_ member: ClubMember) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.detail.role.eyebrow",
                    title: "members.detail.role.title"
                )
                if isSelf(member) {
                    Text("members.roleChange.self")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                } else {
                    roleMenu(member)
                    if member.role == .owner {
                        Text("members.roleChange.ownerHint")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                }
            }
        }
    }

    private func roleMenu(_ member: ClubMember) -> some View {
        Menu {
            ForEach(AssignableClubRole.allCases, id: \.rawValue) { role in
                Button {
                    _Concurrency.Task {
                        await viewModel.changeRole(
                            of: member,
                            to: role,
                            api: session.api,
                            clubId: session.clubId
                        )
                    }
                } label: {
                    if role.rawValue == member.role.rawValue {
                        Label(MembersL10n.roleKey(role), systemImage: "checkmark")
                    } else {
                        Text(MembersL10n.roleKey(role))
                    }
                }
            }
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                if viewModel.isChangingRole {
                    ProgressView()
                        .tint(Theme.Colors.brandInk)
                }
                Text("members.roleChange.menu")
                    .font(Theme.Fonts.bodyStrong)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .accessibilityHidden(true)
            }
            .foregroundStyle(Theme.Colors.brandInk)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.brandSoft)
            .clipShape(Capsule())
        }
        .disabled(viewModel.isChangingRole)
        .accessibilityLabel(Text("members.roleChange.a11y"))
    }
}
