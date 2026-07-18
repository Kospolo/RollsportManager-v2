import Foundation

// ============================================================================
// Rechte-Matrix — CLIENT-SEITIGE Sichtbarkeit (Buttons/Kacheln ein-/ausblenden).
//
// Spiegelt 1:1 apps/web/lib/data/permissions.ts (Web-Referenz) und damit
// ORIGINAL-APP-REFERENZ Abschnitt 1.3. WICHTIG: Die verbindliche Durchsetzung
// passiert IMMER serverseitig (RLS + API-DB-Check). Ein 403/409 bleibt jederzeit
// möglich und muss im UI als sauberer Fehler + Rollback behandelt werden —
// dieses Gating ist nur eine ehrliche Menüführung, KEINE Sicherheitsgrenze.
//
//   is_trainer        = coach / moderator / admin / owner  (guest_coach team-/
//                       zeitgebunden ⇒ hier bewusst false)
//   is_club_admin     = moderator / admin / owner
//   can_manage_*      = treasurer / moderator / admin / owner
//   can_change_role   = owner/admin → jede Rolle (letzter Owner serverseitig
//                                     via 409 geschützt)
//                       moderator   → nur Ziele NICHT in {owner, admin, moderator}
//                       treasurer   → nein
//   is_platform_admin = Token-Claim (keine Club-Rolle). Der Dev-Login liefert
//                       den Claim (noch) nicht im Profil ⇒ Default false,
//                       explizit überschreibbar.
// ============================================================================

/// Rollen, die den Verein administrieren dürfen (Verwaltung sichtbar).
private let clubAdminRoles: Set<ClubRole> = [.owner, .admin, .moderator]
/// Rollen mit Mitglieder-/Finanz-Verwaltung.
private let manageRoles: Set<ClubRole> = [.owner, .admin, .moderator, .treasurer]
/// Rollen mit Sparten-Verwaltung — can_manage_sparten. BEWUSST OHNE moderator
/// (anders als `manageRoles`): nur owner/admin/treasurer (+ Plattform-Admin,
/// separat) dürfen Sparten anlegen/ändern/(de)aktivieren/löschen/zuordnen.
/// Spiegelt Migration 0062–0064 (Web-Referenz: sparten/i18n.ts). Lesen darf
/// jedes Mitglied.
private let manageSpartenRoles: Set<ClubRole> = [.owner, .admin, .treasurer]
/// Trainerstab (guest_coach ist team-/zeitgebunden ⇒ hier nicht enthalten).
private let trainerRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach]
/// Ziele, die ein Moderator NICHT umstufen darf.
private let moderatorProtected: Set<ClubRole> = [.owner, .admin, .moderator]

/// Sichtbarkeits-Rechte des aktuellen Users (reiner Wert-Typ, testbar).
struct Permissions {
    /// Rolle des aktuellen Users (`nil`, wenn nicht angemeldet).
    let role: ClubRole?
    /// coach/moderator/admin/owner (guest_coach hier `false`).
    let isTrainer: Bool
    /// moderator/admin/owner — darf Teams verwalten und die Verwaltung sehen.
    let isClubAdmin: Bool
    /// treasurer/moderator/admin/owner.
    let canManageMembers: Bool
    /// treasurer/moderator/admin/owner.
    let canManageFinance: Bool
    /// Plattform-Super-Admin (Token-Claim, keine Club-Rolle).
    let isPlatformAdmin: Bool

    /// can_manage_sparten = owner/admin/treasurer ODER Plattform-Admin —
    /// NICHT moderator/coach/member. Steuert die Sichtbarkeit ALLER Sparten-
    /// Verwaltungsaktionen (anlegen/ändern/(de)aktivieren/löschen/zuordnen);
    /// das Lesen der Sparten bleibt für alle Mitglieder offen.
    var canManageSparten: Bool {
        isPlatformAdmin || role.map { manageSpartenRoles.contains($0) } ?? false
    }

    /// owner/admin ⇒ jede Rolle darf umgesetzt werden (letzter Owner bleibt
    /// serverseitig via 409 geschützt). moderator ⇒ nur ranktiefere Ziele.
    func canChangeRole(_ target: ClubRole) -> Bool {
        switch role {
        case .owner, .admin: return true
        case .moderator: return !moderatorProtected.contains(target)
        default: return false
        }
    }

    /// Bequemlichkeit: Ziel direkt als Mitglied (nimmt dessen aktuelle Rolle).
    func canChangeRole(_ target: ClubMember) -> Bool {
        canChangeRole(target.role)
    }

    /// Nur owner/admin dürfen die Vereins-Stammdaten/-Einstellungen ändern
    /// (PATCH /clubs/{id} ⇒ „Update own club (owner/admin)").
    var canManageClubSettings: Bool {
        role == .owner || role == .admin
    }
}

/// Baut die Sichtbarkeits-Rechte aus einer Club-Rolle (Server bleibt Autorität).
/// `isPlatformAdmin` kommt später aus dem Token-Claim; bis dahin explizit setzbar.
func permissions(_ role: ClubRole?, isPlatformAdmin: Bool = false) -> Permissions {
    Permissions(
        role: role,
        isTrainer: role.map { trainerRoles.contains($0) } ?? false,
        isClubAdmin: role.map { clubAdminRoles.contains($0) } ?? false,
        canManageMembers: role.map { manageRoles.contains($0) } ?? false,
        canManageFinance: role.map { manageRoles.contains($0) } ?? false,
        isPlatformAdmin: isPlatformAdmin
    )
}

extension SessionStore {
    /// Rechte der aktuell angemeldeten Persona (für UI-Gating in den Views).
    var permissions: Permissions {
        RollsportManager_permissions(session?.profile.clubRole)
    }
}

// Interner Alias, damit die SessionStore-Property nicht mit der freien
// Funktion gleichen Namens kollidiert (Swift-Namensauflösung).
private func RollsportManager_permissions(_ role: ClubRole?) -> Permissions {
    permissions(role)
}
