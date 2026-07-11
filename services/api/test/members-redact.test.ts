// Roster redaction tests (Privacy-Härtung 0021) - pure functions, no database.

import { describe, expect, it } from 'vitest';
import { maySeeFullRoster, redactMemberForViewer } from '../src/routes/members.js';
import type { AuthClaims, ClubRole } from '../src/middleware/auth.js';

const CLUB = '11111111-1111-4111-8111-111111111111';

function claims(role: ClubRole | undefined): AuthClaims {
  return {
    sub: '22222222-2222-4222-8222-222222222222',
    role: 'authenticated',
    club_roles: role ? { [CLUB]: role } : {},
  };
}

function platformAdminClaims(): AuthClaims {
  return {
    sub: '33333333-3333-4333-8333-333333333333',
    role: 'authenticated',
    club_roles: {},
    app_metadata: { is_platform_admin: true },
  };
}

const fullRow = {
  id: 'a',
  club_id: CLUB,
  profile_id: 'p',
  first_name: 'Katrin',
  last_name: 'Grünewald',
  email: 'katrin@example.org',
  birth_date: '1990-01-01',
  role: 'member' as const,
  status: 'active' as const,
  joined_on: '2021-09-01',
  valid_until: '2030-01-01T00:00:00.000Z',
  avatar_url: null,
  team_ids: ['t1'],
};

describe('maySeeFullRoster', () => {
  it('is true for can_manage_members roles', () => {
    for (const r of ['owner', 'admin', 'moderator', 'treasurer'] as ClubRole[]) {
      expect(maySeeFullRoster(claims(r), CLUB)).toBe(true);
    }
  });

  it('is false for plain member and guest_coach', () => {
    expect(maySeeFullRoster(claims('member'), CLUB)).toBe(false);
    expect(maySeeFullRoster(claims('guest_coach'), CLUB)).toBe(false);
    expect(maySeeFullRoster(claims('coach'), CLUB)).toBe(false);
  });

  it('is true for a platform admin regardless of club role', () => {
    expect(maySeeFullRoster(platformAdminClaims(), CLUB)).toBe(true);
  });
});

describe('redactMemberForViewer', () => {
  it('keeps every column for a privileged viewer', () => {
    expect(redactMemberForViewer(fullRow, true)).toEqual(fullRow);
  });

  it('nulls the sensitive columns for a non-privileged viewer', () => {
    const out = redactMemberForViewer(fullRow, false);
    expect(out.birth_date).toBeNull();
    expect(out.email).toBeNull();
    expect(out.valid_until).toBeNull();
    expect(out.profile_id).toBeNull();
    expect(out.joined_on).toBeNull();
  });

  it('keeps the uncritical columns visible for everyone', () => {
    const out = redactMemberForViewer(fullRow, false);
    expect(out.id).toBe('a');
    expect(out.first_name).toBe('Katrin');
    expect(out.last_name).toBe('Grünewald');
    expect(out.role).toBe('member');
    expect(out.status).toBe('active');
    expect(out.team_ids).toEqual(['t1']);
  });

  it('does not mutate the input row', () => {
    const copy = { ...fullRow };
    redactMemberForViewer(fullRow, false);
    expect(fullRow).toEqual(copy);
  });
});
