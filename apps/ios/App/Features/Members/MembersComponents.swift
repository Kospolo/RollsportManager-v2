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
//
// `MemberRowView` (Avatar-Kreis · Name · Team · Rollen-Pill · Chevron, getrennt
// durch Haarlinien) ist ERSETZT durch `MemberCardView` in MembersDirectory.swift
// — eine Karte pro Mensch statt einer Tabellenzeile. Der Grund steht dort im
// Dateikopf. Was aus der alten Zeile GILT UND MITGEWANDERT IST: die
// Beitragsampel bleibt aus dem Verzeichnis RAUS (Wuerde-Befund; das Verzeichnis
// ist der Ort, an dem sich der Verein begegnet, nicht die Debitorenliste). Die
// Logik `MembersViewModel.feeStatus` bleibt unangetastet und lebt im Detail.

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
