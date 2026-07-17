import type { Member, MemberRole } from "@/lib/types";
import { readSession } from "@/lib/auth/storage";

/**
 * Rechte-Matrix aus ORIGINAL-APP-REFERENZ Abschnitt 1.3 — NUR für die
 * clientseitige Sichtbarkeit (Buttons ein-/ausblenden). Die verbindliche
 * Durchsetzung passiert serverseitig (RLS + API-DB-Check); ein 403 bleibt
 * jederzeit möglich und muss als sauberer Toast + Rollback behandelt werden.
 *
 *   is_trainer        = coach / moderator / admin / owner  (+ guest_coach teambezogen)
 *   is_club_admin     = moderator / admin / owner
 *   can_manage_*      = treasurer / moderator / admin / owner
 *   can_change_role   = owner/admin → jede Rolle (letzter Owner serverseitig geschützt)
 *                       moderator   → nur Ziele NICHT in {owner, admin, moderator}
 *                       treasurer   → nein
 *   is_platform_admin = Claim app_metadata.is_platform_admin (keine Club-Rolle)
 */

const CLUB_ADMIN_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator"];
const MANAGE_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator", "treasurer"];
/**
 * Sparten verwalten (Migration 0062–0064, can_manage_sparten). BEWUSST OHNE
 * moderator — anders als is_club_admin. Deckungsgleich mit dem Server: Anlegen/
 * Aendern/(De)Aktivieren/Loeschen/Roster/Team-Zuordnung duerfen nur owner/admin/
 * treasurer (+ Plattform-Admin, siehe canManageSparten).
 */
const MANAGE_SPARTEN_ROLES: readonly MemberRole[] = ["owner", "admin", "treasurer"];
const TRAINER_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator", "coach"];
/** Ziele, die ein Moderator NICHT umstufen darf. */
const MODERATOR_PROTECTED: readonly MemberRole[] = ["owner", "admin", "moderator"];

export interface Permissions {
  /** Rolle des aktuellen Users (null, wenn nicht angemeldet). */
  role: MemberRole | null;
  /** coach/moderator/admin/owner (guest_coach ist team-/zeitgebunden und hier false). */
  isTrainer: boolean;
  /** moderator/admin/owner — darf Teams verwalten und die Verwaltung sehen. */
  isClubAdmin: boolean;
  /** treasurer/moderator/admin/owner. */
  canManageMembers: boolean;
  /** treasurer/moderator/admin/owner. */
  canManageFinance: boolean;
  /**
   * Sparten verwalten: owner/admin/treasurer ODER Plattform-Admin (NICHT
   * moderator/coach/member). Nur Sichtbarkeit — der Server (RLS) ist die Grenze.
   */
  canManageSparten: boolean;
  /** Plattform-Super-Admin (Token-Claim, keine Club-Rolle). */
  isPlatformAdmin: boolean;
  /** Darf die Rolle dieses Ziels (Anzeige) geändert werden? */
  canChangeRole: (target: MemberRole | Pick<Member, "role">) => boolean;
}

function targetRole(target: MemberRole | Pick<Member, "role">): MemberRole {
  return typeof target === "string" ? target : target.role;
}

function sessionIsPlatformAdmin(): boolean {
  return readSession()?.profile.is_platform_admin === true;
}

/**
 * Sichtbarkeits-Rechte des aktuellen Users. `currentUser` kommt aus
 * data.getCurrentUser(); `options.isPlatformAdmin` überschreibt die Ableitung
 * aus der Dev-Session (Default: Token-Claim app_metadata.is_platform_admin).
 */
export function permissions(
  currentUser: Pick<Member, "role"> | null | undefined,
  options?: { isPlatformAdmin?: boolean },
): Permissions {
  const role = currentUser?.role ?? null;
  const isClubAdmin = role != null && CLUB_ADMIN_ROLES.includes(role);
  const canManage = role != null && MANAGE_ROLES.includes(role);
  const isPlatformAdmin = options?.isPlatformAdmin ?? sessionIsPlatformAdmin();

  return {
    role,
    isTrainer: role != null && TRAINER_ROLES.includes(role),
    isClubAdmin,
    canManageMembers: canManage,
    canManageFinance: canManage,
    canManageSparten: isPlatformAdmin || (role != null && MANAGE_SPARTEN_ROLES.includes(role)),
    isPlatformAdmin,
    canChangeRole(target) {
      if (role === "owner" || role === "admin") return true;
      if (role === "moderator") return !MODERATOR_PROTECTED.includes(targetRole(target));
      return false;
    },
  };
}
