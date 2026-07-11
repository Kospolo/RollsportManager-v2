import SwiftUI

// ============================================================================
// „Rollen & Rechte“ — reine Ableitungen + Lokalisierungs-Helfer (kein State,
// keine UI). Spiegelt 1:1 die Web-Referenz
// apps/web/app/(portal)/verwaltung/rollen/derive.ts + i18n.ts und damit
// ORIGINAL-APP-REFERENZ Abschnitt 1.3.
//
// WICHTIG: Die Matrix-Zustände kommen direkt aus dem geteilten Rechte-Helfer
// `permissions()` (apps/ios/App/Auth/Permissions.swift), damit Anzeige und
// Gating nie auseinanderdriften. Durchgesetzt wird ausschließlich serverseitig
// (RLS + API-Rollencheck); ein 403/409 bleibt jederzeit möglich.
//
// Alle Typen/Funktionen tragen den Präfix „Roles…“ (Kollisionsschutz zu den
// parallel gebauten Verwaltungs-Features).
// ============================================================================

// MARK: - Rollen-Reihenfolge (Hierarchie, wie im Web-Hub)

/// Rollen von oben (mächtigste) nach unten — bewusst eigene Liste, weil
/// `ClubRole.allCases` `member` vor `guestCoach` sortiert, die Matrix aber
/// `guest_coach` direkt über `member` zeigt (Web-Reihenfolge).
let rolesRoleOrder: [ClubRole] = [
    .owner, .admin, .moderator, .treasurer, .coach, .guestCoach, .member,
]

// MARK: - Fähigkeiten (Matrix-Spalten)

/// Die fünf Fähigkeitsspalten der Rechte-Matrix.
enum RolesCapability: String, CaseIterable, Hashable {
    case trainer
    case clubAdmin
    case members
    case finance
    case changeRole
}

/// Zustand einer Matrix-Zelle: ✓ / – / eingeschränkt (mit Fußnote).
enum RolesCapState {
    case yes
    case no
    case partial
}

/// Zustand einer Zelle — vier boolesche Fähigkeiten kommen 1:1 aus
/// `permissions()`; Sonderfälle wie im Web:
///  - `guest_coach`/Trainer = eingeschränkt (teambezogen + befristet),
///  - Rollen ändern: owner/admin = ✓, moderator = eingeschränkt, sonst –.
func rolesCapState(_ role: ClubRole, _ capability: RolesCapability) -> RolesCapState {
    let perms = permissions(role)
    switch capability {
    case .trainer:
        if role == .guestCoach { return .partial }
        return perms.isTrainer ? .yes : .no
    case .clubAdmin:
        return perms.isClubAdmin ? .yes : .no
    case .members:
        return perms.canManageMembers ? .yes : .no
    case .finance:
        return perms.canManageFinance ? .yes : .no
    case .changeRole:
        if role == .owner || role == .admin { return .yes }
        if role == .moderator { return .partial }
        return .no
    }
}

/// Fußnoten-Marker je (Rolle, Fähigkeit): „†“ Gasttrainer, „*“ Moderation.
func rolesFootnoteMark(_ role: ClubRole, _ capability: RolesCapability) -> String? {
    if capability == .trainer, role == .guestCoach { return "†" }
    if capability == .changeRole, role == .moderator { return "*" }
    return nil
}

// MARK: - Zuweisbare Rollen (Anzeige-Gate)

/// Rollen, die der aktuelle User vergeben darf (Anzeige-Gate; der Server bleibt
/// Wahrheit). `owner` ist nie zuweisbar (deshalb nicht in `AssignableClubRole`).
/// owner/admin → alle; moderator/andere erreichen die Auswahl gar nicht erst
/// (der Abschnitt ist für sie gesperrt), bekommen aber die rangtiefere Basis.
func rolesAssignableRoles(for actingRole: ClubRole?) -> [AssignableClubRole] {
    let base: [AssignableClubRole] = [.member, .coach, .guestCoach, .treasurer]
    if actingRole == .owner || actingRole == .admin {
        return base + [.moderator, .admin]
    }
    return base
}

/// Sortiert Mitglieder nach Rollen-Hierarchie, dann Nachname/Vorname.
func rolesSortedByRole(_ members: [ClubMember]) -> [ClubMember] {
    members.sorted { a, b in
        let ia = rolesRoleOrder.firstIndex(of: a.role) ?? rolesRoleOrder.count
        let ib = rolesRoleOrder.firstIndex(of: b.role) ?? rolesRoleOrder.count
        if ia != ib { return ia < ib }
        let byLast = a.lastName.localizedCaseInsensitiveCompare(b.lastName)
        if byLast != .orderedSame { return byLast == .orderedAscending }
        return a.firstName.localizedCaseInsensitiveCompare(b.firstName) == .orderedAscending
    }
}

// MARK: - Lokalisierung & Darstellung

/// Lokalisierungs-/Ton-Helfer für „Rollen & Rechte“. Rollen-Labels nutzen die
/// bereits vorhandenen geteilten `role.*`-Keys; alle eigenen Strings tragen den
/// Präfix `rollen.*`.
enum RolesL10n {

    /// Rolle → Label-Key (`role.*`, geteilt mit dem Mitglieder-Feature).
    static func roleLabelKey(_ role: ClubRole) -> LocalizedStringKey {
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

    static func roleLabelKey(_ role: AssignableClubRole) -> LocalizedStringKey {
        switch role {
        case .admin: "role.admin"
        case .moderator: "role.moderator"
        case .treasurer: "role.treasurer"
        case .coach: "role.coach"
        case .member: "role.member"
        case .guestCoach: "role.guestCoach"
        }
    }

    /// Rolle → lokalisierter String (für Interpolation, z. B. im Sperr-Hinweis).
    static func roleLabelString(_ role: ClubRole) -> String {
        switch role {
        case .owner: String(localized: "role.owner")
        case .admin: String(localized: "role.admin")
        case .moderator: String(localized: "role.moderator")
        case .treasurer: String(localized: "role.treasurer")
        case .coach: String(localized: "role.coach")
        case .member: String(localized: "role.member")
        case .guestCoach: String(localized: "role.guestCoach")
        }
    }

    /// Rolle → Kurzbeschreibung in der Matrix (erste Spalte).
    static func roleDescKey(_ role: ClubRole) -> LocalizedStringKey {
        switch role {
        case .owner: "rollen.desc.owner"
        case .admin: "rollen.desc.admin"
        case .moderator: "rollen.desc.moderator"
        case .treasurer: "rollen.desc.treasurer"
        case .coach: "rollen.desc.coach"
        case .member: "rollen.desc.member"
        case .guestCoach: "rollen.desc.guest"
        }
    }

    /// Fähigkeit → Spaltenüberschrift.
    static func capHeaderKey(_ capability: RolesCapability) -> LocalizedStringKey {
        switch capability {
        case .trainer: "rollen.cap.trainer"
        case .clubAdmin: "rollen.cap.clubAdmin"
        case .members: "rollen.cap.members"
        case .finance: "rollen.cap.finance"
        case .changeRole: "rollen.cap.changeRole"
        }
    }

    /// Pill-Ton je Rolle (Status immer Farbe + Wort). Spiegelt `ROLE_TONE` aus
    /// derive.ts: owner = Beere, Stab = Info/Petrol, coach = Grün, sonst neutral.
    static func roleTone(_ role: ClubRole) -> RSMStatusKind {
        switch role {
        case .owner: .brand
        case .admin, .moderator, .treasurer: .info
        case .coach: .success
        case .guestCoach, .member: .neutral
        }
    }
}

// MARK: - Datum (Gasttrainer-Befristung)

enum RolesFormat {
    /// Leitungsformat `yyyy-MM-dd` (Contracts liefern Datumswerte als String).
    private static let wireDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    /// „2026-07-31(T…)“ → lokalisiertes Datum; Unparsebares roh durchreichen.
    static func day(_ wire: String) -> String {
        guard let date = wireDay.date(from: String(wire.prefix(10))) else { return wire }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
