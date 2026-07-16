// ============================================================================
// operator-access.test.ts — die Betreiber-Einsicht (Migration 0051) auf der
// API-Seite. Reine Funktionen, keine Datenbank.
//
// Die DB-Seite ist in supabase/tests/sql/99e_operator_access.sql bewiesen.
// Was hier bewiesen wird, kann SQL nicht sehen: dass die Markierung
// UNFAELSCHBAR ist und die Zusage von db.ts:16 haelt.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { authClaimsSchema } from '../src/middleware/auth.js';
import { hasOperatorOverride, markOperatorAccess } from '../src/lib/operator-context.js';
import { isClubMember, requireClubMember, requireClubRole, ADMIN_ROLES, COACH_ROLES } from '../src/lib/guards.js';
import { ProblemError } from '../src/middleware/error.js';
import type { AuthClaims } from '../src/middleware/auth.js';

const CLUB = '11111111-1111-4111-8111-111111111111';
const PLATFORM_SUB = '90000000-0000-4000-8000-000000000090';

function platformClaims(): AuthClaims {
  return authClaimsSchema.parse({
    sub: PLATFORM_SUB,
    role: 'authenticated',
    club_roles: {},
    app_metadata: { is_platform_admin: true },
  });
}

describe('Betreiber-Einsicht: die Markierung ist unfaelschbar', () => {
  // DER KERN. Ein JWT ist JSON, JSON kennt keine Symbole. Ein Angreifer kann
  // die Markierung also nicht "mitschicken" — nicht "sollte nicht", sondern
  // KANN NICHT. Deshalb ein Symbol und kein Claim-Feld.
  it('ein Token kann die Markierung nicht tragen — auch nicht als Zusatzfeld', () => {
    // authClaimsSchema ist .passthrough(): ein Token DARF Zusatzfelder tragen.
    // Genau deshalb waere ein Claim-Feld die falsche Wahl gewesen.
    const forged = authClaimsSchema.parse(
      JSON.parse(
        JSON.stringify({
          sub: '90000000-0000-4000-8000-000000000009',
          role: 'authenticated',
          club_roles: { [CLUB]: 'member' },
          // der Angreifer raet die Namen und schickt sie alle mit:
          operator_override: true,
          'rsm.operator_override': true,
          app_operator_override: true,
          __operator_override: true,
        }),
      ),
    );
    expect(hasOperatorOverride(forged)).toBe(false);
  });

  it('auch ein Token MIT Plattform-Claim traegt die Markierung nicht von allein', () => {
    // Der Claim ist echt und signiert — trotzdem ist die Einsicht AUS, solange
    // die Middleware sie nicht eingeschaltet (und damit protokolliert) hat.
    expect(hasOperatorOverride(platformClaims())).toBe(false);
  });

  it('erst markOperatorAccess() schaltet ein (das tut nur die Audit-Middleware)', () => {
    const claims = platformClaims();
    markOperatorAccess(claims);
    expect(hasOperatorOverride(claims)).toBe(true);
  });

  // Die Zusage aus db.ts:16 — "die Datenbank sieht EXAKT das, was das Token
  // gesagt hat, nichts mehr". db.ts serialisiert die Claims mit JSON.stringify
  // nach request.jwt.claims; Symbol-Schluessel fallen dabei heraus. Der Schalter
  // reist als eigene Sitzungsvariable, nicht als erfundener Claim.
  it('die Markierung gelangt NICHT in request.jwt.claims', () => {
    const claims = platformClaims();
    markOperatorAccess(claims);
    const serialised = JSON.stringify(claims);
    expect(serialised).not.toContain('operator');
    expect(Object.keys(JSON.parse(serialised) as object).sort()).toEqual(
      ['app_metadata', 'club_roles', 'role', 'sub'].sort(),
    );
  });
});

describe('Betreiber-Einsicht: die Gates', () => {
  it('OHNE Einsicht bleibt der Plattform-Admin ausgesperrt (der gemeldete 403)', () => {
    const claims = platformClaims();
    expect(isClubMember(claims, CLUB)).toBe(false);
    expect(() => requireClubMember(claims, CLUB)).toThrow(ProblemError);
  });

  it('MIT Einsicht kommt er hinein — owner-gleich, wie in der DB (cap_rank = 5)', () => {
    const claims = platformClaims();
    markOperatorAccess(claims);
    expect(isClubMember(claims, CLUB)).toBe(true);
    expect(requireClubMember(claims, CLUB)).toBe('owner');
    // Die Rollenmengen, an denen Kueren (COACH_ROLES) und Vereins-
    // Einstellungen (ADMIN_ROLES) haengen, enthalten 'owner'.
    expect(requireClubRole(claims, CLUB, COACH_ROLES)).toBe('owner');
    expect(requireClubRole(claims, CLUB, ADMIN_ROLES)).toBe('owner');
  });

  // DIE GEGENPROBE. Ein normales Mitglied aendert sich um KEIN Bisschen —
  // und die Markierung ist fuer es auch nicht erreichbar (siehe oben).
  it('ein Mitglied bleibt exakt, was es war', () => {
    const member = authClaimsSchema.parse({
      sub: '90000000-0000-4000-8000-000000000009',
      role: 'authenticated',
      club_roles: { [CLUB]: 'member' },
    });
    expect(isClubMember(member, CLUB)).toBe(true);
    expect(requireClubMember(member, CLUB)).toBe('member');
    expect(() => requireClubRole(member, CLUB, ADMIN_ROLES)).toThrow(ProblemError);
    expect(hasOperatorOverride(member)).toBe(false);
  });
});
