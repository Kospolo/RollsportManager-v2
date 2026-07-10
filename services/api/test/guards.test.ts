// Role-guard tests - pure functions, no database.

import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  COACH_ROLES,
  FINANCE_ROLES,
  MANAGE_MEMBER_ROLES,
  canAssignRole,
  checkRoleChange,
  hasClubRole,
  isPlatformAdmin,
  requireClubMember,
  requireClubRole,
  requirePlatformAdmin,
} from '../src/lib/guards.js';
import { ProblemError } from '../src/middleware/error.js';
import type { AuthClaims, ClubRole } from '../src/middleware/auth.js';

const CLUB = '11111111-1111-4111-8111-111111111111';
const OTHER_CLUB = '33333333-3333-4333-8333-333333333333';

function claims(role: AuthClaims['club_roles'][string] | undefined): AuthClaims {
  return {
    sub: '22222222-2222-4222-8222-222222222222',
    role: 'authenticated',
    club_roles: role ? { [CLUB]: role } : {},
  };
}

describe('requireClubMember / requireClubRole', () => {
  it('returns the role for a member', () => {
    expect(requireClubMember(claims('member'), CLUB)).toBe('member');
  });

  it('throws 403 for non-members', () => {
    expect(() => requireClubMember(claims(undefined), CLUB)).toThrowError(ProblemError);
    try {
      requireClubMember(claims('coach'), OTHER_CLUB);
      expect.unreachable();
    } catch (e) {
      expect((e as ProblemError).status).toBe(403);
    }
  });

  it('enforces role sets (tenant-scoped)', () => {
    expect(requireClubRole(claims('treasurer'), CLUB, FINANCE_ROLES)).toBe('treasurer');
    expect(() => requireClubRole(claims('member'), CLUB, FINANCE_ROLES)).toThrowError(ProblemError);
    expect(() => requireClubRole(claims('coach'), CLUB, ADMIN_ROLES)).toThrowError(ProblemError);
    expect(hasClubRole(claims('guest_coach'), CLUB, COACH_ROLES)).toBe(true);
    expect(hasClubRole(claims('guest_coach'), CLUB, FINANCE_ROLES)).toBe(false);
  });

  it('treats moderator as admin-near (is_club_admin, manage members/finance, trainer)', () => {
    expect(requireClubRole(claims('moderator'), CLUB, ADMIN_ROLES)).toBe('moderator');
    expect(requireClubRole(claims('moderator'), CLUB, MANAGE_MEMBER_ROLES)).toBe('moderator');
    expect(requireClubRole(claims('moderator'), CLUB, FINANCE_ROLES)).toBe('moderator');
    expect(hasClubRole(claims('moderator'), CLUB, COACH_ROLES)).toBe(true);
  });

  it('keeps treasurer out of admin/trainer sets but in finance/member management', () => {
    expect(() => requireClubRole(claims('treasurer'), CLUB, ADMIN_ROLES)).toThrowError(ProblemError);
    expect(hasClubRole(claims('treasurer'), CLUB, COACH_ROLES)).toBe(false);
    expect(requireClubRole(claims('treasurer'), CLUB, MANAGE_MEMBER_ROLES)).toBe('treasurer');
  });
});

describe('checkRoleChange (last-owner + self-change rules)', () => {
  const base = {
    callerRole: 'owner',
    callerIsTarget: false,
    targetRole: 'member',
    newRole: 'coach',
    activeOwnerCount: 1,
  } as const;

  it('allows owner promoting a member to coach', () => {
    expect(checkRoleChange({ ...base })).toBeUndefined();
  });

  it('allows admin changing non-owner roles', () => {
    expect(checkRoleChange({ ...base, callerRole: 'admin' })).toBeUndefined();
  });

  it('rejects non-admin callers', () => {
    for (const callerRole of ['treasurer', 'coach', 'member', 'guest_coach'] as const) {
      expect(checkRoleChange({ ...base, callerRole })?.status).toBe(403);
    }
  });

  it('rejects changing your own role (v1 gap)', () => {
    expect(checkRoleChange({ ...base, callerIsTarget: true })?.status).toBe(403);
  });

  it('rejects an admin touching an owner row', () => {
    expect(
      checkRoleChange({ ...base, callerRole: 'admin', targetRole: 'owner', activeOwnerCount: 2 })?.status,
    ).toBe(403);
  });

  it('rejects demoting the LAST owner even for owners', () => {
    expect(
      checkRoleChange({ ...base, targetRole: 'owner', newRole: 'admin', activeOwnerCount: 1 })?.status,
    ).toBe(409);
  });

  it('allows demoting an owner when another active owner remains', () => {
    expect(
      checkRoleChange({ ...base, targetRole: 'owner', newRole: 'admin', activeOwnerCount: 2 }),
    ).toBeUndefined();
  });

  // Moderator hierarchy (Referenz 1.3): may only touch ranks below moderator.
  it('lets a moderator change a member to coach (both below moderator rank)', () => {
    expect(
      checkRoleChange({ ...base, callerRole: 'moderator', targetRole: 'member', newRole: 'coach' }),
    ).toBeUndefined();
  });

  it('lets a moderator assign treasurer/guest_coach (still below rank)', () => {
    for (const newRole of ['treasurer', 'guest_coach', 'member'] as const) {
      expect(
        checkRoleChange({ ...base, callerRole: 'moderator', targetRole: 'coach', newRole }),
      ).toBeUndefined();
    }
  });

  it('forbids a moderator granting admin or moderator (target rank too high)', () => {
    for (const newRole of ['admin', 'moderator'] as const) {
      expect(
        checkRoleChange({ ...base, callerRole: 'moderator', targetRole: 'member', newRole })?.status,
      ).toBe(403);
    }
  });

  it('forbids a moderator changing an existing admin/moderator/owner', () => {
    for (const targetRole of ['admin', 'moderator', 'owner'] as const) {
      expect(
        checkRoleChange({
          ...base,
          callerRole: 'moderator',
          targetRole,
          newRole: 'coach',
          activeOwnerCount: 2,
        })?.status,
      ).toBe(403);
    }
  });
});

describe('canAssignRole (INSERT/invite - mirrors can_change_member_role)', () => {
  it('owner may assign anything except owner is owner-only', () => {
    for (const role of ['admin', 'moderator', 'treasurer', 'coach', 'member', 'guest_coach'] as const) {
      expect(canAssignRole('owner', role)).toBe(true);
    }
    expect(canAssignRole('owner', 'owner')).toBe(true);
    expect(canAssignRole('admin', 'owner')).toBe(false);
  });

  it('admin may assign any non-owner role', () => {
    for (const role of ['admin', 'moderator', 'treasurer', 'coach', 'member'] as const) {
      expect(canAssignRole('admin', role)).toBe(true);
    }
  });

  it('moderator only below its own rank', () => {
    expect(canAssignRole('moderator', 'member')).toBe(true);
    expect(canAssignRole('moderator', 'coach')).toBe(true);
    expect(canAssignRole('moderator', 'treasurer')).toBe(true);
    expect(canAssignRole('moderator', 'admin')).toBe(false);
    expect(canAssignRole('moderator', 'moderator')).toBe(false);
  });

  it('treasurer may only create plain members; coach/member none', () => {
    expect(canAssignRole('treasurer', 'member')).toBe(true);
    for (const role of ['admin', 'moderator', 'treasurer', 'coach', 'guest_coach'] as const) {
      expect(canAssignRole('treasurer', role)).toBe(false);
    }
    for (const caller of ['coach', 'member', 'guest_coach'] as ClubRole[]) {
      expect(canAssignRole(caller, 'member')).toBe(false);
    }
  });
});

describe('platform admin claim (mirrors app.is_platform_admin)', () => {
  const base: AuthClaims = {
    sub: '44444444-4444-4444-8444-444444444444',
    role: 'authenticated',
    club_roles: {},
  };

  it('recognises every accepted claim shape', () => {
    expect(isPlatformAdmin({ ...base, app_metadata: { is_platform_admin: true } })).toBe(true);
    expect(isPlatformAdmin({ ...base, is_platform_admin: true })).toBe(true);
    expect(isPlatformAdmin({ ...base, app_metadata: { role: 'super_admin' } })).toBe(true);
    expect(isPlatformAdmin({ ...base, platform_role: 'super_admin' })).toBe(true);
  });

  it('rejects ordinary members and throws 403 via the guard', () => {
    expect(isPlatformAdmin(base)).toBe(false);
    expect(isPlatformAdmin({ ...base, club_roles: { [CLUB]: 'owner' } })).toBe(false);
    expect(() => requirePlatformAdmin(base)).toThrowError(ProblemError);
    try {
      requirePlatformAdmin(base);
      expect.unreachable();
    } catch (e) {
      expect((e as ProblemError).status).toBe(403);
    }
  });

  it('lets a platform admin through the guard', () => {
    expect(() =>
      requirePlatformAdmin({ ...base, app_metadata: { is_platform_admin: true } }),
    ).not.toThrow();
  });
});
