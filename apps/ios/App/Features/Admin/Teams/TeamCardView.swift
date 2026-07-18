import SwiftUI

/// Eine Team-Kachel: Name + Altersklasse, Trainerstab (Avatare + Klartext),
/// Kader-Zahlen — plus die Aktionen (Kader, Umbenennen, Löschen). Aktionen
/// erscheinen nur, wenn der aktuelle Nutzer verwalten darf; die verbindliche
/// Prüfung bleibt serverseitig. Web-Referenz: teams/TeamCard.tsx.
struct TeamCardView: View {
    let team: Team
    let roster: AdminTeamRoster
    /// Zugeordnete Sparte (nil = keine / nicht sichtbar) — als Badge im Kopf.
    var sparte: Sparte?
    let canManage: Bool
    let onRoster: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void

    private var coaches: [ClubMember] { roster.coaches }
    private var skaters: [ClubMember] { roster.skaters }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                header
                if let sparte { sparteRow(sparte) }
                coachRow
                countCaption
                if canManage { actions }
            }
        }
    }

    // MARK: - Sparte-Zeile

    private func sparteRow(_ sparte: Sparte) -> some View {
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
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("teams.card.sparte.a11y \(sparte.name)"))
    }

    // MARK: - Kopf (Icon-Kachel · Name · Altersklasse)

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

            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(verbatim: team.name)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                if let age = team.ageGroup, !age.trimmingCharacters(in: .whitespaces).isEmpty {
                    ageBadge(age)
                } else {
                    Text("teams.card.noAgeGroup")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func ageBadge(_ age: String) -> some View {
        Text(verbatim: age)
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s1)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())
    }

    // MARK: - Trainerstab (Avatare + Namen)

    private var coachRow: some View {
        HStack(spacing: Theme.Spacing.s3) {
            if coaches.isEmpty {
                Circle()
                    .fill(Theme.Colors.bgSunken)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: "person")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.Colors.inkFaint)
                    )
                    .accessibilityHidden(true)
                Text("teams.card.noCoaches")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
            } else {
                avatarStack
                Text(verbatim: coaches.map(AdminTeamsViewModel.fullName).joined(separator: " · "))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 0)
        }
    }

    private var avatarStack: some View {
        HStack(spacing: -8) {
            ForEach(coaches.prefix(3), id: \.id) { coach in
                RSMAvatarView(name: AdminTeamsViewModel.fullName(coach), personId: coach.id, size: 28)
                    .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2))
            }
        }
        .accessibilityHidden(true)
    }

    private var countCaption: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Text("teams.card.coaches \(coaches.count)")
            Text(verbatim: "·")
            if skaters.isEmpty {
                Text("teams.card.emptyRoster")
            } else {
                Text("teams.card.skaters \(skaters.count)")
            }
        }
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.inkFaint)
    }

    // MARK: - Aktionen

    private var actions: some View {
        HStack(spacing: Theme.Spacing.s2) {
            actionButton(titleKey: "teams.card.action.roster", systemImage: "person.2", action: onRoster)
            actionButton(titleKey: "teams.card.action.edit", systemImage: "pencil", action: onEdit)
            Spacer(minLength: 0)
            Button(action: onDelete) {
                Text("teams.card.action.delete")
                    .font(Theme.Fonts.caption.weight(.bold))
                    .foregroundStyle(Theme.Colors.danger)
                    .padding(.horizontal, Theme.Spacing.s3)
                    .frame(minHeight: 34)
            }
            .buttonStyle(RSMPressableButtonStyle())
        }
        .padding(.top, Theme.Spacing.s1)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Colors.line)
                .frame(height: 1)
                .offset(y: -Theme.Spacing.s2)
        }
    }

    private func actionButton(
        titleKey: LocalizedStringKey,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .semibold))
                Text(titleKey)
                    .font(Theme.Fonts.caption.weight(.bold))
            }
            .foregroundStyle(Theme.Colors.brandInk)
            .padding(.horizontal, Theme.Spacing.s3)
            .frame(minHeight: 34)
            .background(Theme.Colors.brandSoft)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
    }
}
