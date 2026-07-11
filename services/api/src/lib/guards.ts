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

// ---------------------------------------------------------------------------
// Role sets = the Referenz 1.3 capability matrix, mirrored from the DB helpers
// (app.is_club_admin / is_club_trainer / can_manage_finance / can_manage_members
// in migration 0007). moderator counts as admin-near; treasurer manages
// members+finance but never roles.
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

export function isClubMember(claims: AuthClaims, clubId: string): boolean {
  return clubRole(claims, clubId) !== undefined;
}

export function hasClubRole(claims: AuthClaims, clubId: string, roles: readonly ClubRole[]): boolean {
  const role = clubRole(claims, clubId);
  return role !== undefined && roles.includes(role);
}

/** Throw 403 unless the caller is a member of the club (any role). */
export function requireClubMember(claims: AuthClaims, clubId: string): ClubRole {
  const role = clubRole(claims, clubId);
  if (role === undefined) throw problem(403, 'Forbidden', 'Not a member of this club');
  return role;
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
// Role ASSIGNMENT rule (INSERT / invite) - mirrors app.can_change_member_role.
//   owner     -> any role (incl. owner)
//   admin     -> any role except owner
//   moderator -> only ranks below moderator (member/coach/treasurer/guest_coach)
//   treasurer -> only 'member'
//   everyone else -> nothing
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
