// Role-guard tests - pure functions, no database.

import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  COACH_ROLES,
  FINANCE_ROLES,
  checkRoleChange,
  hasClubRole,
  requireClubMember,
  requireClubRole,
} from '../src/lib/guards.js';
import { ProblemError } from '../src/middleware/error.js';
import type { AuthClaims } from '../src/middleware/auth.js';

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
});
