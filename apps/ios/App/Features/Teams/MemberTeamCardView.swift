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

    /// Ab den Accessibility-Stufen wird gestapelt statt nebeneinander gestellt:
    /// sonst schneidet der Teamname ab („Kürgrupp…“), die Trainernamen enden in
    /// „Sandra Vog…“ und die Pille „Mein Team“ wird zur Blase. Bei den
    /// Standardgrößen bleibt das Layout unverändert.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var isAX: Bool { dynamicTypeSize.isAccessibilitySize }

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
        let layout = isAX
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s3))
            : AnyLayout(HStackLayout(alignment: .top, spacing: Theme.Spacing.s3))
        return layout {
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
                    .lineLimit(isAX ? 3 : 1)
                    .fixedSize(horizontal: false, vertical: true)
                badgeRow
            }
            if !isAX {
                Spacer(minLength: 0)
                // Rein dekorativ — bei großer Schrift zählt die Breite mehr.
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
        }
    }

    /// Altersband-Chip und „Mein Team“ — nebeneinander nur bei Standardgrößen.
    private var badgeRow: some View {
        let layout = isAX
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s2))
            : AnyLayout(HStackLayout(spacing: Theme.Spacing.s2))
        return layout {
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
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            if isMine {
                RSMStatusPill(text: "teamsMember.badge.mine", kind: .brand)
            }
        }
    }

    // MARK: - Trainerstab

    private var coachRow: some View {
        let layout = isAX
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s2))
            : AnyLayout(HStackLayout(spacing: Theme.Spacing.s3))
        return layout {
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
                    .lineLimit(isAX ? 2 : 1)
                    .fixedSize(horizontal: false, vertical: true)
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
                    // Bei großer Schrift lieber umbrechen als Namen abschneiden.
                    .lineLimit(isAX ? 4 : 1)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
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
        .foregroundStyle(Theme.Colors.inkSoft)
    }
}

/// Sparte-Zeile (Icon-Chip in der Sparten-Akzentfarbe + Name) — dieselbe Optik
/// wie in der Verwaltung, hier rein informativ.
struct SparteBadgeRow: View {
    let sparte: Sparte

    /// Bei Accessibility-Schrift stapeln — nebeneinander bliebe vom
    /// Sparten-Namen nur „Rollkunstla…“ übrig.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let accent = SparteColorCatalog.color(for: sparte.farbe)
        let isAX = dynamicTypeSize.isAccessibilitySize
        let layout = isAX
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s2))
            : AnyLayout(HStackLayout(spacing: Theme.Spacing.s2))
        return layout {
            HStack(spacing: Theme.Spacing.s2) {
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
                    .lineLimit(isAX ? 3 : 1)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !sparte.aktiv {
                RSMStatusPill(text: "teamsMember.sparte.inactive", kind: .neutral)
            }
            if !isAX { Spacer(minLength: 0) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("teamsMember.sparte.a11y \(sparte.name)"))
    }
}
