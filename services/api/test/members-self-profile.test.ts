// Self-profile visibility projection tests (0053) - pure functions, no database.
// Prueft die API-Seite der Projektion (redactSelfProfile) und den Rollen-Claim
// (maySeeInternalSelfProfile). Die DB-Seite (Spalte/Trigger/Schreibweg/
// can_act_for_member) deckt supabase/tests/sql/99h_selbstprofil_publikum.sql ab.

import { describe, expect, it } from 'vitest';
import { maySeeInternalSelfProfile, redactSelfProfile } from '../src/routes/members.js';
import type { AuthClaims, ClubRole } from '../src/middleware/auth.js';

const CLUB = '11111111-1111-4111-8111-111111111111';

function claims(role: ClubRole | undefined): AuthClaims {
  return {
    sub: '22222222-2222-4222-8222-222222222222',
    role: 'authenticated',
    club_roles: role ? { [CLUB]: role } : {},
  };
}

/** A roster row carrying the self-profile columns + the hidden flag. */
function row(
  visibility: 'public' | 'internal',
  selfOrGuardian: boolean,
): Record<string, unknown> {
  return {
    id: 'a',
    first_name: 'Katrin',
    last_name: 'Grünewald',
    profile_motto: 'Immer mit Schwung',
    profile_favorite_discipline: 'Solotanz',
    profile_skating_since: 2005,
    profile_visibility: visibility,
    _self_or_guardian: selfOrGuardian,
  };
}

describe('maySeeInternalSelfProfile', () => {
  it('is true for Vorstand/Trainer (owner/admin/moderator/coach/guest_coach)', () => {
    for (const r of ['owner', 'admin', 'moderator', 'coach', 'guest_coach'] as ClubRole[]) {
      expect(maySeeInternalSelfProfile(claims(r), CLUB)).toBe(true);
    }
  });

  it('is false for a plain member', () => {
    expect(maySeeInternalSelfProfile(claims('member'), CLUB)).toBe(false);
  });

  it('is false for the treasurer (finance, not Vorstand/Trainer)', () => {
    // Bewusste Trennung: der Kassenwart sieht Kontaktdaten, aber NICHT die
    // internen Selbst-Profile — dieselbe Grenze wie bei der Anwesenheit (0045).
    expect(maySeeInternalSelfProfile(claims('treasurer'), CLUB)).toBe(false);
  });
});

describe('redactSelfProfile', () => {
  it('(a) public profile is visible to any member (non-internal viewer)', () => {
    const out = redactSelfProfile(row('public', false), false);
    expect(out.profile_motto).toBe('Immer mit Schwung');
    expect(out.profile_favorite_discipline).toBe('Solotanz');
    expect(out.profile_skating_since).toBe(2005);
    expect(out.profile_visibility).toBe('public');
  });

  it('(b) internal profile is nulled for a non-internal viewer', () => {
    const out = redactSelfProfile(row('internal', false), false);
    expect(out.profile_motto).toBeNull();
    expect(out.profile_favorite_discipline).toBeNull();
    expect(out.profile_skating_since).toBeNull();
    // Die Stufe selbst sieht nur, wer die Felder sieht.
    expect(out.profile_visibility).toBeNull();
  });

  it('(b) internal profile IS visible to a Vorstand/Trainer viewer', () => {
    const out = redactSelfProfile(row('internal', false), true);
    expect(out.profile_motto).toBe('Immer mit Schwung');
    expect(out.profile_visibility).toBe('internal');
  });

  it('(c) own row / own child stays visible even when internal', () => {
    const out = redactSelfProfile(row('internal', true), false);
    expect(out.profile_motto).toBe('Immer mit Schwung');
    expect(out.profile_visibility).toBe('internal');
  });

  it('always strips the hidden _self_or_guardian flag from the output', () => {
    const visible = redactSelfProfile(row('public', true), false);
    const hidden = redactSelfProfile(row('internal', false), false);
    expect('_self_or_guardian' in visible).toBe(false);
    expect('_self_or_guardian' in hidden).toBe(false);
  });

  it('keeps the uncritical columns for everyone', () => {
    const out = redactSelfProfile(row('internal', false), false);
    expect(out.id).toBe('a');
    expect(out.first_name).toBe('Katrin');
    expect(out.last_name).toBe('Grünewald');
  });

  it('does not mutate the input row', () => {
    const input = row('internal', false);
    const copy = { ...input };
    redactSelfProfile(input, false);
    expect(input).toEqual(copy);
  });
});
