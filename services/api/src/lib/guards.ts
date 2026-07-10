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

/** Roles allowed to manage club structure / roster. */
export const ADMIN_ROLES: readonly ClubRole[] = ['owner', 'admin'];
/** Roles allowed to run trainings (events, attendance, routines). */
export const COACH_ROLES: readonly ClubRole[] = ['owner', 'admin', 'coach', 'guest_coach'];
/** Roles allowed to see/manage money. */
export const FINANCE_ROLES: readonly ClubRole[] = ['owner', 'admin', 'treasurer'];

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
 *
 * Rules (v1 gap closed + task requirement):
 *   1. Only owner/admin may change roles at all.
 *   2. Nobody changes their OWN role - not even to demote themselves
 *      (mirrors the protect_club_membership trigger).
 *   3. Owner rows are only touched by owners (trigger mirrors this too).
 *   4. The LAST active owner can never be demoted - a club must always
 *      keep at least one owner (checked only in the API; the DB cannot
 *      know this rule per-row).
 */
export function checkRoleChange(input: RoleChangeInput): ReturnType<typeof problem> | undefined {
  const { callerRole, callerIsTarget, targetRole, newRole, activeOwnerCount } = input;

  if (!ADMIN_ROLES.includes(callerRole)) {
    return problem(403, 'Forbidden', 'Only owner or admin may change member roles');
  }
  if (callerIsTarget) {
    return problem(403, 'Forbidden', 'Changing your own role is not allowed');
  }
  if (targetRole === 'owner') {
    if (callerRole !== 'owner') {
      return problem(403, 'Forbidden', 'Only owners may change owner roles');
    }
    if (activeOwnerCount <= 1) {
      return problem(409, 'Conflict', 'Cannot demote the last owner of the club');
    }
  }
  return undefined;
}
