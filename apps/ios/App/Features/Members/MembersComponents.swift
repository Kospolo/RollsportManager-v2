import SwiftUI

// ============================================================================
// Kleine Bausteine des Mitglieder-Features: Lokalisierungs-/Format-Helfer,
// Filter-Chip, Listenzeile, Beitragsampel, Detail-Zeile.
// Alle Typen sind mit „Members…“ präfixiert (Kollisionsschutz Parallel-Teams).
// ============================================================================

extension ClubMember {
    /// Anzeigename „Vorname Nachname“ — eigener Name wg. Kollisionsschutz.
    var membersFullName: String { "\(firstName) \(lastName)" }
}

// MARK: - Lokalisierungs-Helfer

enum MembersL10n {

    /// Rollen-Label — nutzt die geteilten `role.*`-Keys (bestehen bereits).
    static func roleKey(_ role: ClubRole) -> LocalizedStringKey {
        switch role {
        case .owner: "role.owner"
        case .admin: "role.admin"
        case .moderator: "role.moderator"
        case .treasurer: "role.treasurer"
        case .coach: "role.coach"
        case .member: "role.member"
        case .guestCoach: "role.guestCoach"
        }
    }

    static func roleKey(_ role: AssignableClubRole) -> LocalizedStringKey {
        switch role {
        case .admin: "role.admin"
        case .moderator: "role.moderator"
        case .treasurer: "role.treasurer"
        case .coach: "role.coach"
        case .member: "role.member"
        case .guestCoach: "role.guestCoach"
        }
    }

    /// Staff-Rollen tragen den Brand-Chip, einfache Mitglieder bleiben neutral.
    static func roleKind(_ role: ClubRole) -> RSMStatusKind {
        role == .member ? .neutral : .brand
    }

    static func statusKey(_ status: MemberStatus) -> LocalizedStringKey {
        switch status {
        case .pending: "members.status.pending"
        case .rejected: "members.status.rejected"
        case .active: "members.status.active"
        case .inactive: "members.status.inactive"
        case .left: "members.status.left"
        }
    }

    static func statusKind(_ status: MemberStatus) -> RSMStatusKind {
        switch status {
        case .active: .success
        case .pending: .info
        case .rejected: .danger
        case .inactive, .left: .neutral
        }
    }

    /// Bekannte Beziehungscodes („parent“) übersetzt, Unbekanntes roh.
    static func relationText(_ relation: String) -> Text {
        relation == "parent"
            ? Text("members.family.relation.parent")
            : Text(verbatim: relation)
    }
}

// MARK: - Datums-Helfer

enum MembersFormat {
    /// Leitungsformat `yyyy-MM-dd` (Contracts lassen Datumswerte als String).
    private static let wireDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    /// „2016-04-01(T…)“ → lokalisiertes Datum; Unparsebares roh durchreichen.
    static func day(_ wire: String) -> String {
        guard let date = wireDay.date(from: String(wire.prefix(10))) else { return wire }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

// MARK: - Beitragsampel

/// Beitragsampel: Mahnstufen-Treppe aus dem Design-System bzw. „bezahlt“.
struct MembersFeePill: View {
    let status: MembersViewModel.FeeStatus

    var body: some View {
        switch status {
        case .dunning(let level):
            RSMStatusPill.dunning(level: level)
        case .paid:
            RSMStatusPill(text: "members.fee.paid", kind: .success)
        }
    }
}

// MARK: - Rollen-Filter-Chip

/// Filter-Chip in Pill-Form — ausgewählt = brand-soft-Tint (die volle Beere
/// bleibt der einen Primäraktion pro Sichtbereich vorbehalten).
struct MembersFilterChip: View {
    let title: LocalizedStringKey
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(isSelected ? Theme.Colors.brandInk : Theme.Colors.inkSoft)
                .padding(.horizontal, Theme.Spacing.s4)
                .frame(minHeight: Theme.Size.touchTarget)
                .background(isSelected ? Theme.Colors.brandSoft : Theme.Colors.bgSurface)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(
                        isSelected ? Theme.Colors.brandInk : Theme.Colors.line,
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Listenzeile

/// Zeile der Mitgliederliste: Avatar · Name + Team · Rollen-Pill.
///
/// WAS HIER BEWUSST NICHT MEHR STEHT: die BEITRAGSAMPEL (Mahnstufe/„bezahlt“).
/// Das Web hat sie im Verzeichnis schon gestrichen (MembersClient.tsx) — iOS
/// zieht nach. Eine Mahnstufe neben einem Kindernamen ist ein Würde-Problem:
/// das Verzeichnis ist der Ort, an dem sich der Verein begegnet, nicht die
/// Debitorenliste. Der Zahlungsstand war NIE ein Leck (RLS zeigt jedem nur die
/// eigene Familie) — er gehört nur nicht hierher. Beiträge leben im
/// Kassenbereich; die Logik (MembersViewModel.feeStatus) bleibt unangetastet.
struct MemberRowView: View {
    let member: ClubMember
    let teamNames: String?

    /// Ab den Accessibility-Stufen ist nebeneinander kein Platz mehr: Name,
    /// Team UND Rollen-Pill in einer Zeile zwingen den Namen ins Abschneiden
    /// („Jo-han…“). Dann werden die Pills unter den Namen gelegt.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    HStack(spacing: Theme.Spacing.s3) {
                        RSMAvatarView(name: member.membersFullName, personId: member.id, size: 40)
                        nameBlock
                        Spacer(minLength: Theme.Spacing.s2)
                        chevron
                    }
                    HStack(spacing: Theme.Spacing.s2) { pills }
                }
            } else {
                HStack(spacing: Theme.Spacing.s3) {
                    RSMAvatarView(name: member.membersFullName, personId: member.id, size: 40)
                    nameBlock
                    Spacer(minLength: Theme.Spacing.s2)
                    VStack(alignment: .trailing, spacing: Theme.Spacing.s1) { pills }
                    chevron
                }
            }
        }
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
    }

    private var nameBlock: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: member.membersFullName)
                .font(Theme.Fonts.listTitle)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(2)
            if let teamNames {
                Text(verbatim: teamNames)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(2)
            } else {
                Text("members.row.noTeam")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    @ViewBuilder
    private var pills: some View {
        RSMStatusPill(
            text: MembersL10n.roleKey(member.role),
            kind: MembersL10n.roleKind(member.role)
        )
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.Colors.inkFaint)
            .accessibilityHidden(true)
    }
}

// MARK: - Detail-Zeile

/// Schlüssel-Wert-Zeile im Stammdaten-Block des Details.
struct MembersDetailRow: View {
    let label: LocalizedStringKey
    let value: Text

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s3) {
            Text(label)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(width: 116, alignment: .leading)
            value
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}
