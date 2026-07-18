import SwiftUI

/// Team-Kachel der LESENDEN Übersicht: Name, Altersband, Sparte-Badge,
/// Trainerstab und Kader-Zahl. Ohne jede Verwaltungs-Aktion — die steckt
/// weiterhin in der Verwaltung (`AdminTeamsView`). Web-Referenz: teams/TeamCard.tsx.
struct MemberTeamCardView: View {
    let team: Team
    let roster: TeamsViewModel.Roster
    /// Zugeordnete Sparte (nil = keine gesetzt / Sparten nicht geladen).
    var sparte: Sparte?
    /// Die angemeldete Person steht auf diesem Kader.
    var isMine: Bool = false

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                header
                if let sparte { SparteBadgeRow(sparte: sparte) }
                coachRow
                countCaption
            }
        }
    }

    // MARK: - Kopf

    private var header: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous)
                .fill(Theme.Colors.brandSoft)
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: "person.3.fill")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.Colors.brandInk)
                )
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text(verbatim: team.name)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                HStack(spacing: Theme.Spacing.s2) {
                    if let age = team.ageGroup, !age.trimmingCharacters(in: .whitespaces).isEmpty {
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
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                    if isMine {
                        RSMStatusPill(text: "teamsMember.badge.mine", kind: .brand)
                    }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
        }
    }

    // MARK: - Trainerstab

    private var coachRow: some View {
        HStack(spacing: Theme.Spacing.s3) {
            if roster.coaches.isEmpty {
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
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
            } else {
                HStack(spacing: -8) {
                    ForEach(roster.coaches.prefix(3), id: \.id) { coach in
                        RSMAvatarView(
                            name: TeamsViewModel.fullName(coach),
                            personId: coach.id,
                            size: 28
                        )
                        .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2))
                    }
                }
                .accessibilityHidden(true)
                Text(verbatim: roster.coaches.map(TeamsViewModel.fullName).joined(separator: " · "))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 0)
        }
    }

    private var countCaption: some View {
        HStack(spacing: Theme.Spacing.s2) {
            if roster.skaters.isEmpty {
                Text("teamsMember.card.emptyRoster")
            } else {
                Text("teamsMember.card.skaters \(roster.skaters.count)")
            }
        }
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.inkFaint)
    }
}

/// Sparte-Zeile (Icon-Chip in der Sparten-Akzentfarbe + Name) — dieselbe Optik
/// wie in der Verwaltung, hier rein informativ.
struct SparteBadgeRow: View {
    let sparte: Sparte

    var body: some View {
        let accent = SparteColorCatalog.color(for: sparte.farbe)
        return HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: SparteIconCatalog.symbol(for: sparte.icon))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 24, height: 24)
                .background(accent.opacity(0.16))
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous))
                .accessibilityHidden(true)
            Text(verbatim: sparte.name)
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
            if !sparte.aktiv {
                RSMStatusPill(text: "teamsMember.sparte.inactive", kind: .neutral)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("teamsMember.sparte.a11y \(sparte.name)"))
    }
}
