// ============================================================================
// lib/guards.ts - role guards as PURE functions (unit-testable without DB).
//
// These guards are the API-layer authorization (Blueprint: the API is the
// enforcement point). The database RLS + protective triggers remain the
// second line of defense via impersonation (src/db.ts) - a bug here is
// still caught there, and vice versa.
// ============================================================================

import type { AuthClaims, ClubRole } from '../middleware/auth.js';
import { problem } from '../middleware/error.js';
import { hasOperatorOverride } from './operator-context.js';

// ---------------------------------------------------------------------------
// Role sets = the Referenz 1.3 capability matrix, mirrored from the DB helpers
// (app.is_club_admin / is_club_trainer / can_manage_finance / can_manage_members
// in migration 0007). moderator counts as admin-near; treasurer manages
// members+finance but never roles.
//
// ### STATUS nach RBAC Phase 2 ###
// Diese Sets lesen die EINE Rolle aus dem TOKEN. Sie sind damit blind fuer
// Mehrfachrollen (die DB kennt seit 0022 beliebig viele) und bis zu einer
// Token-Lebensdauer veraltet. Der Ersatz steht in lib/capabilities.ts
// (requireCap / requireClubRoleDb — beide loesen aus app.member_roles auf).
// Umgestellt sind bisher: die 5 Service-Mode-Routen (dort ist der Guard die
// ALLEINIGE Autorisierung, RLS ist aus) + events.ts attendance.
// Der Rest ist FAIL-CLOSED, nicht falsch: der Claim kann eine Rolle nur
// UNTERbehaupten (eine Zweitrolle fehlt) — die Person bekommt also zu wenig
// Rechte, nie zu viele. Wo er sie UEBERbehauptet, faengt RLS es ab (42501).
//
// ACHTUNG bei der weiteren Umstellung: ein blinder Tausch Rollenset -> has_cap
// LOCKERT an zwei Stellen, weil der Seed den Stand der DB-POLICIES eingefroren
// hat, nicht den der API — und die API ist dort STRENGER als ihre eigene Policy:
//   * teams.ts     ADMIN_ROLES, aber teams >= manage = +coach  (0007:276)
//   * events.ts    EVENT_WRITE_ROLES ohne moderator,
//                  aber events >= manage = +moderator          (0007:286)
// Beide brauchen einen Split wie bei den Kueren (0028) oder eine ausdrueckliche
// Entscheidung — kein Suchen-und-Ersetzen. Kein Test prueft diese Strenge.
// ---------------------------------------------------------------------------

/** is_club_admin - club settings, teams, structure (moderator counts as admin). */
export const ADMIN_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator'];
/** is_club_trainer - events, attendance, routines (+ guest_coach, time-boxed in DB). */
export const COACH_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator', 'coach', 'guest_coach'];
/** can_manage_finance - invoices, ledger (owner/admin/moderator/treasurer). */
export const FINANCE_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator', 'treasurer'];
/** can_manage_members - roster create/edit/status (owner/admin/moderator/treasurer). */
export const MANAGE_MEMBER_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator', 'treasurer'];
/**
 * Locker management (create/edit/delete/assign/release) - owner/admin/treasurer
 * ONLY (Privacy-Härtung 0021). Moderator and coach are deliberately excluded:
 * they cannot even SEE lockers (RLS), let alone manage them. Mirrors the
 * lockers RLS policies in migration 0021.
 */
export const LOCKER_MANAGE_ROLES: readonly ClubRole[] = ['owner', 'admin', 'treasurer'];

/** Roles that may change other members' roles at all (can_change_member_role > none). */
const ROLE_CHANGERS: readonly ClubRole[] = ['owner', 'admin', 'moderator'];
/** Ranks a moderator may never grant or touch (owner/admin/moderator). */
const MODERATOR_BLOCKED: readonly ClubRole[] = ['owner', 'admin', 'moderator'];

export function clubRole(claims: AuthClaims, clubId: string): ClubRole | undefined {
  return claims.club_roles[clubId];
}

/**
 * BETREIBER-EINSICHT (Migration 0051) — die Rolle, mit der ein eingeschalteter
 * Plattform-Admin in einem Verein auftritt.
 *
 * 'owner' ist hier keine Notluege, sondern die genaue Entsprechung dessen, was
 * die Datenbank in derselben Lage tut: app.cap_rank liefert bei
 * app.operator_override() den Rang 5 — exakt den Wert, den sonst nur die
 * geschuetzte owner-Rolle bekommt (0025:225-243 / 0051), und
 * app.can_change_member_role laesst ihn wie einen owner Rollen vergeben.
 * Genau EIN Begriff von Betreiber-Autoritaet, in API und DB derselbe.
 *
 * Die drei Stellen, die den Rueckgabewert von requireClubRole auswerten
 * (members.ts:155/198/294 -> canAssignRole/checkRoleChange), bekommen damit die
 * richtige Antwort: der Betreiber darf jede Rolle vergeben. Die
 * Selbstschutz-Regel dort greift trotzdem nie versehentlich — sie vergleicht
 * target.profile_id mit claims.sub, und der Betreiber hat in keinem Verein eine
 * Mitgliedszeile.
 */
const OPERATOR_CLUB_ROLE: ClubRole = 'owner';

export function isClubMember(claims: AuthClaims, clubId: string): boolean {
  return hasOperatorOverride(claims) || clubRole(claims, clubId) !== undefined;
}

export function hasClubRole(claims: AuthClaims, clubId: string, roles: readonly ClubRole[]): boolean {
  if (hasOperatorOverride(claims)) return true;
  const role = clubRole(claims, clubId);
  return role !== undefined && roles.includes(role);
}

/** Throw 403 unless the caller is a member of the club (any role). */
export function requireClubMember(claims: AuthClaims, clubId: string): ClubRole {
  const role = clubRole(claims, clubId);
  if (role !== undefined) return role;
  // Betreiber-Einsicht: nur, wenn die Audit-Middleware sie eingeschaltet hat
  // (und das tut sie nur mit Protokollzeile). Der blosse Plattform-Admin-Claim
  // fuehrt weiterhin hierher ins 403 — 0051 haengt den Zugriff an den Nachweis.
  if (hasOperatorOverride(claims)) return OPERATOR_CLUB_ROLE;
  throw problem(403, 'Forbidden', 'Not a member of this club');
}

/** Throw 403 unless the caller holds one of the given roles in the club. */
export function requireClubRole(claims: AuthClaims, clubId: string, roles: readonly ClubRole[]): ClubRole {
  const role = requireClubMember(claims, clubId);
  if (!roles.includes(role)) {
    throw problem(403, 'Forbidden', `Requires one of: ${roles.join(', ')}`);
  }
  return role;
}

// ---------------------------------------------------------------------------
// Platform admin (super_admin level) - a JWT claim, NOT a club role.
// Mirrors app.is_platform_admin() (migration 0007): app_metadata.is_platform_admin
// (GoTrue emits raw_app_meta_data), a top-level flag, or a super_admin role claim.
// ---------------------------------------------------------------------------

export function isPlatformAdmin(claims: AuthClaims): boolean {
  return (
    claims.is_platform_admin === true ||
    claims.app_metadata?.is_platform_admin === true ||
    claims.app_metadata?.role === 'super_admin' ||
    claims.platform_role === 'super_admin'
  );
}

/** Throw 403 unless the caller carries the platform-admin claim. */
export function requirePlatformAdmin(claims: AuthClaims): void {
  if (!isPlatformAdmin(claims)) {
    throw problem(403, 'Forbidden', 'Platform administrator privileges required');
  }
}

// ---------------------------------------------------------------------------
// Role ASSIGNMENT rule (INSERT / invite).
//   owner     -> any role (incl. owner)
//   admin     -> any role except owner
//   moderator -> only ranks below moderator (member/coach/treasurer/guest_coach)
//   treasurer -> only 'member'
//   everyone else -> nothing
//
// ### RICHTIGSTELLUNG (Phase 2) — der alte Kommentar war belegt falsch ###
// Hier stand "mirrors app.can_change_member_role". Das stimmt so nicht:
// can_change_member_role (0025:107-142) liefert fuer treasurer IMMER false.
// Die treasurer -> 'member'-Zeile unten spiegelt nicht diese Funktion, sondern
// die AUSNAHME in protect_club_membership (0007:203-207):
//     if app.can_manage_members(new.club_id)
//        and new.role <> 'member'                    <- genau diese Zeile
//        and not app.can_change_member_role(...)
// Beim INSERT ist role='member' also ausdruecklich ausgenommen -> der
// Kassenwart DARF einfache Mitglieder anlegen. API und DB stimmen hier
// Ende-zu-Ende ueberein; empirisch gegen rsm2-pg-dev geprueft, und
// 90_roles_matrix.sql:98 ("treasurer: MAY add a plain member") friert es als
// SOLLVERHALTEN ein.
//
// Der Korrekturblock in blueprint/RBAC-DESIGN.md behauptete, guards.ts sei hier
// "laxer als die DB" und muesse in Phase 2 angeglichen werden. Ein solches
// "Angleichen" waere eine REGRESSION (der Kassenwart koennte kein Mitglied mehr
// anlegen) und braeche 90_roles_matrix.sql:98. Deshalb bleibt der Code, wie er
// ist; der Blueprint ist korrigiert.
//
// Die Hierarchie hier ist ausserdem bewusst NICHT auf has_cap umgestellt: sie
// ist eine RANG-Ordnung zwischen Rollen, keine Stufen-Skala je Faehigkeit.
// cap_rank kennt keinen Rang ZWISCHEN Rollen — die beiden Modelle passen nicht
// aufeinander. Das Netz bleibt der Trigger protect_member_roles (0024:158).
// ---------------------------------------------------------------------------
export function canAssignRole(callerRole: ClubRole, targetRole: ClubRole): boolean {
  if (targetRole === 'owner') return callerRole === 'owner';
  if (callerRole === 'owner' || callerRole === 'admin') return true;
  if (callerRole === 'moderator') return !MODERATOR_BLOCKED.includes(targetRole);
  if (callerRole === 'treasurer') return targetRole === 'member';
  return false;
}

// ---------------------------------------------------------------------------
// Role-change rules (clubs/:id/members/:memberId/role)
// ---------------------------------------------------------------------------

export interface RoleChangeInput {
  /** caller's role in the club (from claims) */
  callerRole: ClubRole;
  /** true when the target membership row belongs to the caller */
  callerIsTarget: boolean;
  /** target member's current role */
  targetRole: ClubRole;
  /** requested new role (owner is not assignable via this endpoint) */
  newRole: Exclude<ClubRole, 'owner'>;
  /** number of ACTIVE, non-deleted owner rows in the club (incl. target) */
  activeOwnerCount: number;
}

/**
 * Returns undefined when the change is allowed, otherwise a ProblemError.
 * Mirrors app.can_change_member_role + protect_club_membership (migration 0007).
 *
 * Rules (Referenz 1.3 - full hierarchy):
 *   1. Only owner/admin/moderator may change roles at all (treasurer & below: no).
 *   2. Nobody changes their OWN role (mirrors the protect_club_membership trigger).
 *   3. Owner rows (old OR would-be owner) are only touched by owners.
 *   4. A moderator may only change roles whose OLD and NEW rank are both below
 *      moderator (never owner/admin/moderator) - the admin-near-but-not-admin rule.
 *   5. The LAST active owner can never be demoted (API-only; the DB cannot know
 *      this per-row).
 */
export function checkRoleChange(input: RoleChangeInput): ReturnType<typeof problem> | undefined {
  const { callerRole, callerIsTarget, targetRole, newRole, activeOwnerCount } = input;

  if (!ROLE_CHANGERS.includes(callerRole)) {
    return problem(403, 'Forbidden', 'Only owner, admin or moderator may change member roles');
  }
  if (callerIsTarget) {
    return problem(403, 'Forbidden', 'Changing your own role is not allowed');
  }
  // Owner rows are owner-only (newRole can never be 'owner' via the API).
  if (targetRole === 'owner' && callerRole !== 'owner') {
    return problem(403, 'Forbidden', 'Only owners may change owner roles');
  }
  // Moderator rank guard: both the current and the target role must be below moderator.
  if (
    callerRole === 'moderator' &&
    (MODERATOR_BLOCKED.includes(targetRole) || MODERATOR_BLOCKED.includes(newRole))
  ) {
    return problem(403, 'Forbidden', 'Moderators may only assign roles below their own rank');
  }
  if (targetRole === 'owner' && activeOwnerCount <= 1) {
    return problem(409, 'Conflict', 'Cannot demote the last owner of the club');
  }
  return undefined;
}
