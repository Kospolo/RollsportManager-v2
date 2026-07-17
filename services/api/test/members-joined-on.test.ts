// ============================================================================
// members-joined-on.test.ts — die ZWEITE Redigier-Stufe (0045).
//
// Der Nutzer: joined_on soll "trainer und hoeher" sehen. Der bequeme Weg waere
// gewesen, dem coach maySeeFullRoster zu geben — dann bekaeme er E-MAIL und
// GEBURTSDATUM der Kinder gleich mit, obwohl der Seed member_contact/coach
// ausdruecklich auf 'none' stellt. Diese Datei nagelt fest, dass die Ausweitung
// GENAU EIN Feld breit ist.
//
// NEU angelegt; members-redact.test.ts bleibt unveraendert und beweist damit
// nebenbei die Rueckwaertskompatibilitaet: der Zwei-Argument-Aufruf von
// redactMemberForViewer verhaelt sich exakt wie vor 0045.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { maySeeFullRoster, maySeeJoinedOn, redactMemberForViewer } from '../src/routes/members.js';
import { markOperatorAccess } from '../src/lib/operator-context.js';
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
  profile_motto: 'Immer mit Schwung',
  profile_favorite_discipline: 'Solotanz',
  profile_skating_since: 2005,
};

describe('maySeeJoinedOn — "Trainer und hoeher"', () => {
  it('is true for the coach (the change the user ordered)', () => {
    expect(maySeeJoinedOn(claims('coach'), CLUB)).toBe(true);
  });

  it('stays true for every can_manage_members role', () => {
    for (const r of ['owner', 'admin', 'moderator', 'treasurer'] as ClubRole[]) {
      expect(maySeeJoinedOn(claims(r), CLUB)).toBe(true);
    }
  });

  it('is false for a plain member', () => {
    expect(maySeeJoinedOn(claims('member'), CLUB)).toBe(false);
  });

  // Ein Gast-Trainer ist eine vereinsEXTERNE Person auf Zeit — und war der
  // belegte Leck-Fall bei /reports/anniversaries. "Trainer und hoeher" meint
  // ihn nicht.
  it('is false for the guest_coach (deliberately NOT "Trainer und hoeher")', () => {
    expect(maySeeJoinedOn(claims('guest_coach'), CLUB)).toBe(false);
  });

  // Seit 0051/ef9acdf ans Protokoll gekoppelt: blosser Claim -> nein, erst der
  // Operator-Override (Audit-Middleware) -> ja. Siehe members-redact.test.ts.
  it('is FALSE for a bare platform-admin claim, true only with the override', () => {
    expect(maySeeJoinedOn(platformAdminClaims(), CLUB)).toBe(false);
    const c = platformAdminClaims();
    markOperatorAccess(c);
    expect(maySeeJoinedOn(c, CLUB)).toBe(true);
  });
});

describe('die zwei Stufen greifen unabhaengig voneinander', () => {
  // DER KERN DIESER DATEI: genau ein Feld mehr, nicht fuenf.
  it('coach: sees joined_on but STILL no birth_date / e-mail', () => {
    const out = redactMemberForViewer(
      fullRow,
      maySeeFullRoster(claims('coach'), CLUB),
      maySeeJoinedOn(claims('coach'), CLUB),
    );
    expect(out.joined_on).toBe('2021-09-01');
    expect(out.birth_date).toBeNull();
    expect(out.email).toBeNull();
    expect(out.valid_until).toBeNull();
    expect(out.profile_id).toBeNull();
  });

  it('plain member: joined_on stays redacted', () => {
    const out = redactMemberForViewer(
      fullRow,
      maySeeFullRoster(claims('member'), CLUB),
      maySeeJoinedOn(claims('member'), CLUB),
    );
    expect(out.joined_on).toBeNull();
    expect(out.birth_date).toBeNull();
  });

  it('guest_coach: joined_on stays redacted', () => {
    const out = redactMemberForViewer(
      fullRow,
      maySeeFullRoster(claims('guest_coach'), CLUB),
      maySeeJoinedOn(claims('guest_coach'), CLUB),
    );
    expect(out.joined_on).toBeNull();
  });

  it('treasurer: keeps the full row (no regression)', () => {
    const out = redactMemberForViewer(
      fullRow,
      maySeeFullRoster(claims('treasurer'), CLUB),
      maySeeJoinedOn(claims('treasurer'), CLUB),
    );
    expect(out).toEqual(fullRow);
  });

  // Rueckwaertskompatibilitaet: ohne drittes Argument faellt joined_on mit den
  // Kontaktdaten — exakt das Verhalten, das members-redact.test.ts festhaelt.
  it('two-argument call behaves exactly as before 0045', () => {
    expect(redactMemberForViewer(fullRow, false).joined_on).toBeNull();
    expect(redactMemberForViewer(fullRow, true)).toEqual(fullRow);
  });
});

describe('das Selbst-Profil ist NICHT redigiert', () => {
  // "mitglied darf ... wenn das mitglied was ueber sich eintraegt, dann das
  // auch" — freiwillig veroeffentlicht, also fuer jedes Mitglied sichtbar.
  it('every viewer keeps motto / discipline / skating_since', () => {
    for (const r of ['member', 'coach', 'guest_coach'] as ClubRole[]) {
      const out = redactMemberForViewer(
        fullRow,
        maySeeFullRoster(claims(r), CLUB),
        maySeeJoinedOn(claims(r), CLUB),
      );
      expect(out.profile_motto).toBe('Immer mit Schwung');
      expect(out.profile_favorite_discipline).toBe('Solotanz');
      expect(out.profile_skating_since).toBe(2005);
    }
  });
});
