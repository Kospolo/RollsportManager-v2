import SwiftUI

/// Eine Kader-Karte: Avatar, Name, Rolle — als Ganzes antippbar und führt auf
/// die bestehende Mitglieder-Detailseite. Web-Referenz: teams/TeamRosterCard.tsx.
///
/// Es steht bewusst NUR drauf, was die Roster-Antwort liefert: der Server
/// redigiert für Mitglieder selbst (keine E-Mail, kein Geburtsdatum). Der Client
/// filtert nichts nach und erfindet nichts.
struct TeamRosterCardView: View {
    let member: ClubMember
    /// Markiert die eigene Zeile („Das bist du").
    var isMe: Bool = false

    private var name: String { TeamsViewModel.fullName(member) }

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: name, personId: member.id, size: 44)

            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(verbatim: name)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                HStack(spacing: Theme.Spacing.s2) {
                    RSMStatusPill(
                        text: MembersL10n.roleKey(member.role),
                        kind: MembersL10n.roleKind(member.role)
                    )
                    if isMe {
                        RSMStatusPill(text: "teamsMember.badge.me", kind: .brand)
                    }
                }
            }

            Spacer(minLength: Theme.Spacing.s2)

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
        }
        .padding(Theme.Spacing.s4)
        .frame(maxWidth: .infinity, minHeight: Theme.Size.listRow, alignment: .leading)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .strokeBorder(Theme.Colors.line, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("teamsMember.roster.open.a11y \(name)"))
    }
}
