import SwiftUI

/// Erfolgs-Karte: Medaillen-Symbol, Medaille/Platzierung als Wort-Pills, Titel,
/// Wettkampf, Datum und optionale Notiz. Bei `showMember` zusätzlich das
/// Mitglied (Avatar + Name) für die Vereins-Vitrine. Lesend — Bearbeiten/
/// Löschen bietet die iOS-App bewusst (noch) nicht. Web-Referenz:
/// `AchievementCard.tsx`.
struct AchievementCardView: View {
    let achievement: MedalAchievement
    /// Aufgelöstes Mitglied zu `memberId` (kann fehlen, z. B. Ex-Mitglied).
    let member: ClubMember?
    /// Mitgliedszeile einblenden (Vereins-Vitrine); `false` in „Meine Medaillen“.
    let showMember: Bool

    var body: some View {
        RSMCard {
            HStack(alignment: .top, spacing: Theme.Spacing.s4) {
                MedalIconView(medal: achievement.medal, size: .lg)
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    badges
                    Text(verbatim: achievement.title)
                        .font(Theme.Fonts.body(size: 15.5, weight: .bold))
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let competition = achievement.competitionName, !competition.isEmpty {
                        meta(icon: "trophy", text: Text(verbatim: competition))
                    }
                    metaFooter
                    if let note = achievement.note, !note.isEmpty {
                        Text(verbatim: note)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, Theme.Spacing.s1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Bausteine

    private var badges: some View {
        HStack(spacing: Theme.Spacing.s2) {
            RSMStatusPill(
                text: MedaillenL10n.medalLabelKey(achievement.medal),
                kind: achievement.medal == nil ? .neutral : .warn
            )
            if let placement = achievement.placement {
                RSMStatusPill(text: "medaillen.placement \(placement)", kind: .neutral)
            }
        }
    }

    // In der Vereins-Vitrine steht das Mitglied prominenter (eigene Zeile),
    // darunter das Datum; in „Meine Medaillen“ genügt das Datum.
    private var metaFooter: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            if showMember { memberRow }
            date
        }
    }

    @ViewBuilder private var memberRow: some View {
        HStack(spacing: Theme.Spacing.s2) {
            if let member {
                RSMAvatarView(
                    name: MedaillenL10n.memberName(member),
                    personId: member.id,
                    size: 26
                )
                Text(verbatim: MedaillenL10n.memberName(member))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .frame(width: 26, height: 26)
                    .background(Theme.Colors.bgSunken)
                    .clipShape(Circle())
                Text(MedaillenL10n.medalLabelKey(nil))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private var date: some View {
        meta(icon: "clock", text: Text(verbatim: MedaillenFormat.dayText(achievement.achievedOn)))
    }

    private func meta(icon: String, text: Text) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Colors.inkFaint)
            text
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
    }
}
