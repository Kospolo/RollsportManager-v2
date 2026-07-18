import SwiftUI

/// Team-Detail für MITGLIEDER (Web-Referenz: teams/[id]/TeamDetail.tsx) — REIN
/// LESEND: Kopf (Name, Altersband, Sparte-Badge, „Mein Team"), Trainerstab und
/// der GANZE Kader als antippbare Karten. Ein Tipp führt auf die bestehende
/// Mitglieder-Detailseite (`MemberDetailView`).
///
/// Rechte werden hier NICHT entschieden: was ein Mitglied nicht sehen darf,
/// liefert die API schon nicht (Roster-Redigierung). Es wird nichts
/// nachgefiltert — angezeigt wird, was ankommt.
struct TeamDetailView: View {
    let teamId: String
    @ObservedObject var model: TeamsViewModel
    @ObservedObject var membersModel: MembersViewModel
    @EnvironmentObject private var session: SessionStore
#if DEBUG
    /// Ziel der DEBUG-Smoke-Automation (`-devTeamOpenFirstMember`).
    @State private var devMemberRoute: DevMemberRoute?
#endif

    var body: some View {
        ScrollView {
            if let team = model.team(id: teamId) {
                let roster = model.roster(of: team)
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    headerCard(team, roster: roster)
                    rosterSection(roster)
                }
                .padding(Theme.Spacing.s5)
            } else {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "person.3",
                        title: "teamsMember.notFound.title",
                        message: "teamsMember.notFound.message"
                    )
                }
                .padding(Theme.Spacing.s5)
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(verbatim: model.team(id: teamId)?.name ?? ""))
        .navigationBarTitleDisplayMode(.inline)
#if DEBUG
        // NUR DEBUG/Smoke-Test: `-devTeamOpenFirstMember YES` springt vom Kader
        // direkt auf das erste Mitglieder-Profil (für Screenshots).
        .task {
            guard UserDefaults.standard.bool(forKey: "devTeamOpenFirstMember"),
                  let team = model.team(id: teamId),
                  let first = model.roster(of: team).skaters.first
            else { return }
            try? await _Concurrency.Task.sleep(nanoseconds: 600_000_000)
            devMemberRoute = DevMemberRoute(id: first.id)
        }
        .navigationDestination(item: $devMemberRoute) { route in
            MemberDetailView(memberId: route.id, viewModel: membersModel)
        }
#endif
    }

    // MARK: - Kopf (Identität · Sparte · Trainerstab)

    private func headerCard(_ team: Team, roster: TeamsViewModel.Roster) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                    RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous)
                        .fill(Theme.Colors.brandSoft)
                        .frame(width: 52, height: 52)
                        .overlay(
                            Image(systemName: "person.3.fill")
                                .font(.system(size: 22, weight: .semibold))
                                .foregroundStyle(Theme.Colors.brandInk)
                        )
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        Text("teamsMember.detail.eyebrow")
                            .font(Theme.Fonts.eyebrow)
                            .tracking(Theme.Fonts.eyebrowTracking)
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.Colors.inkFaint)
                        Text(verbatim: team.name)
                            .font(Theme.Fonts.h2)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                        HStack(spacing: Theme.Spacing.s2) {
                            if let age = team.ageGroup,
                               !age.trimmingCharacters(in: .whitespaces).isEmpty {
                                Text(verbatim: age)
                                    .font(Theme.Fonts.caption.weight(.semibold))
                                    .foregroundStyle(Theme.Colors.inkSoft)
                                    .padding(.horizontal, Theme.Spacing.s3)
                                    .padding(.vertical, Theme.Spacing.s1)
                                    .background(Theme.Colors.bgSunken)
                                    .clipShape(Capsule())
                            } else {
                                Text("teamsMember.card.noAgeGroup")
                                    .font(Theme.Fonts.caption)
                                    .foregroundStyle(Theme.Colors.inkSoft)
                            }
                            if model.isMine(team) {
                                RSMStatusPill(text: "teamsMember.badge.mine", kind: .brand)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }

                // Sparte NUR zeigen, wenn eine gesetzt (und sichtbar) ist —
                // sonst steht hier bewusst nichts statt einer leeren Zeile.
                if let sparte = model.sparte(of: team) {
                    Divider().overlay(Theme.Colors.line)
                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        Text("teamsMember.detail.sparte")
                            .font(Theme.Fonts.eyebrow)
                            .tracking(Theme.Fonts.eyebrowTracking)
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.Colors.inkFaint)
                        SparteBadgeRow(sparte: sparte)
                    }
                }

                Divider().overlay(Theme.Colors.line)
                coachSection(roster.coaches)
            }
        }
    }

    @ViewBuilder
    private func coachSection(_ coaches: [ClubMember]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text("teamsMember.detail.coaches")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)

            if coaches.isEmpty {
                HStack(spacing: Theme.Spacing.s3) {
                    Circle()
                        .fill(Theme.Colors.bgSunken)
                        .frame(width: 28, height: 28)
                        .overlay(
                            Image(systemName: "person")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Theme.Colors.inkFaint)
                        )
                        .accessibilityHidden(true)
                    Text("teamsMember.card.noCoaches")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            } else {
                // Auch der Trainerstab ist antippbar — dasselbe Ziel wie im Kader.
                VStack(spacing: Theme.Spacing.s2) {
                    ForEach(coaches, id: \.id) { coach in
                        memberLink(coach) {
                            HStack(spacing: Theme.Spacing.s3) {
                                RSMAvatarView(
                                    name: TeamsViewModel.fullName(coach),
                                    personId: coach.id,
                                    size: 32
                                )
                                Text(verbatim: TeamsViewModel.fullName(coach))
                                    .font(Theme.Fonts.bodyStrong)
                                    .foregroundStyle(Theme.Colors.inkPrimary)
                                    .lineLimit(1)
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Theme.Colors.inkFaint)
                                    .accessibilityHidden(true)
                            }
                            .frame(minHeight: Theme.Size.touchTarget)
                            .contentShape(Rectangle())
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Kader

    @ViewBuilder
    private func rosterSection(_ roster: TeamsViewModel.Roster) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(alignment: .firstTextBaseline) {
                Text("teamsMember.detail.roster")
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Spacer(minLength: Theme.Spacing.s2)
                if !roster.skaters.isEmpty {
                    Text("teamsMember.card.skaters \(roster.skaters.count)")
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
            .padding(.horizontal, Theme.Spacing.s1)

            if roster.skaters.isEmpty {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "person.2",
                        title: "teamsMember.roster.empty.title",
                        message: "teamsMember.roster.empty.message"
                    )
                }
            } else {
                LazyVStack(spacing: Theme.Spacing.s3) {
                    ForEach(roster.skaters, id: \.id) { skater in
                        memberLink(skater) {
                            TeamRosterCardView(member: skater, isMe: isMe(skater))
                        }
                    }
                }
            }
        }
    }

    // MARK: - Sprung ins Mitglieder-Profil

    /// Ein Kader-Eintrag führt auf die BESTEHENDE Mitglieder-Detailseite. Ist
    /// die Person dort (noch) nicht geladen, zeigt jene Seite ihren eigenen
    /// Leerzustand — es wird kein zweiter Datenpfad gebaut.
    private func memberLink(
        _ member: ClubMember,
        @ViewBuilder label: () -> some View
    ) -> some View {
        NavigationLink {
            MemberDetailView(memberId: member.id, viewModel: membersModel)
        } label: {
            label()
        }
        .buttonStyle(RSMPressableButtonStyle())
    }

    private func isMe(_ member: ClubMember) -> Bool {
        member.id == session.session?.profile.memberId
    }
}

#if DEBUG
/// Deep-Link-Ziel der DEBUG-Smoke-Automation (ein Mitglied aus dem Kader).
struct DevMemberRoute: Identifiable, Hashable {
    let id: String
}
#endif
