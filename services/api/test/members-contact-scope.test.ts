// ============================================================================
// members-contact-scope.test.ts — die ZEILENWEISE Kontakt-Sichtbarkeit (0054).
//
// Der Nutzer (2026-07-17): eine Trainer:in soll die Eltern IHRER Team-Kinder
// erreichen (E-Mail/Telefon/Anschrift/Geburtstag) — NICHT die fremder Kinder aus
// Teams, die sie nicht betreut. Das ist keine Betrachter-Regel (wie
// maySeeFullRoster), sondern eine (Betrachter × Zielzeile)-Regel: maySeeContactOf.
//
// NEU angelegt; members-redact.test.ts / members-joined-on.test.ts bleiben
// unveraendert (und belegen damit die Rueckwaertskompatibilitaet der 2-/3-Arg-
// Aufrufe von redactMemberForViewer).
//
// Der Team-Schnitt selbst (coached_team_ids ∩ team_members) wird in der DB
// gerechnet und kommt als verstecktes _coach_of_member in die Zeile. Diese Datei
// nagelt die TS-Seite fest: WER die Zeile (bei gegebenem _coach_of_member) sehen
// darf — inklusive des bewussten guest_coach-Ausschlusses.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { maySeeContactOf, maySeeFullRoster, maySeeJoinedOn, redactMemberForViewer } from '../src/routes/members.js';
import type { AuthClaims, ClubRole } from '../src/middleware/auth.js';

const CLUB = '11111111-1111-4111-8111-111111111111';

function claims(role: ClubRole | undefined): AuthClaims {
  return {
    sub: '22222222-2222-4222-8222-222222222222',
    role: 'authenticated',
    club_roles: role ? { [CLUB]: role } : {},
  };
}

// Ein Kind-Datensatz MIT Kontaktdaten. _coach_of_member ist das versteckte
// SQL-Ergebnis: true = der/die Betrachter:in betreut ein Team dieses Kindes.
function childRow(coachOfMember: boolean) {
  return {
    id: 'child',
    club_id: CLUB,
    profile_id: 'p-child',
    first_name: 'Ben',
    last_name: 'Müller',
    email: 'ben@example.org',
    birth_date: '2015-07-19',
    phone: '+49 7132 776655',
    postal_address: 'Öhringer Straße 45, 74172 Neckarsulm',
    role: 'member' as const,
    status: 'active' as const,
    joined_on: '2022-04-01',
    valid_until: null,
    avatar_url: null,
    team_ids: ['t1'],
    _coach_of_member: coachOfMember,
  };
}

// Was ein Aufrufer aus der Zeile herausbekommt — genau wie in members.ts/chat.ts.
function projectFor(role: ClubRole, row: Record<string, unknown>) {
  return redactMemberForViewer(
    row,
    maySeeFullRoster(claims(role), CLUB),
    maySeeJoinedOn(claims(role), CLUB),
    maySeeContactOf(claims(role), CLUB, row),
  );
}

describe('maySeeContactOf — die zeilenweise Regel', () => {
  it('is true for every can_manage_members role, regardless of team overlap', () => {
    for (const r of ['owner', 'admin', 'moderator', 'treasurer'] as ClubRole[]) {
      expect(maySeeContactOf(claims(r), CLUB, childRow(false))).toBe(true);
    }
  });

  it('is true for a coach ONLY on a member of one of their teams', () => {
    expect(maySeeContactOf(claims('coach'), CLUB, childRow(true))).toBe(true);
    expect(maySeeContactOf(claims('coach'), CLUB, childRow(false))).toBe(false);
  });

  // ⚠️ Der Gast-Trainer betreut auch Teams (team_members role=coach), also ist
  // _coach_of_member fuer ihn genauso true — der Ausschluss sitzt im Claims-Check.
  // Er ist vereinsEXTERN auf Zeit und hat mit Elternkontakten nichts zu tun.
  it('is FALSE for the guest_coach even WITH team overlap (deliberate exclusion)', () => {
    expect(maySeeContactOf(claims('guest_coach'), CLUB, childRow(true))).toBe(false);
  });

  it('is false for a plain member', () => {
    expect(maySeeContactOf(claims('member'), CLUB, childRow(true))).toBe(false);
  });
});

describe('redactMemberForViewer — was der coach WIRKLICH herausbekommt', () => {
  it('coach on OWN team member: sees the PARENT contact, but not the admin fields', () => {
    const out = projectFor('coach', childRow(true));
    // Elternkontakt sichtbar:
    expect(out.email).toBe('ben@example.org');
    expect(out.phone).toBe('+49 7132 776655');
    expect(out.postal_address).toBe('Öhringer Straße 45, 74172 Neckarsulm');
    expect(out.birth_date).toBe('2015-07-19');
    // Verwaltungs-Kontakt bleibt dem Manager vorbehalten:
    expect(out.profile_id).toBeNull();
    // Und das versteckte Feld ist raus (Contract-Hygiene):
    expect('_coach_of_member' in out).toBe(false);
  });

  it('coach on a FOREIGN team member: phone/email/address are nulled', () => {
    const out = projectFor('coach', childRow(false));
    expect(out.email).toBeNull();
    expect(out.phone).toBeNull();
    expect(out.postal_address).toBeNull();
    expect(out.birth_date).toBeNull();
  });

  it('treasurer (manager): sees the full parent contact of everyone', () => {
    const out = projectFor('treasurer', childRow(false));
    expect(out.phone).toBe('+49 7132 776655');
    expect(out.postal_address).toBe('Öhringer Straße 45, 74172 Neckarsulm');
  });

  it('plain member: sees no foreign contact at all', () => {
    const out = projectFor('member', childRow(false));
    expect(out.phone).toBeNull();
    expect(out.postal_address).toBeNull();
    expect(out.email).toBeNull();
  });

  // POSITIVKONTROLLE (TS): naehme man die guest_coach-Schranke aus maySeeContactOf
  // heraus, saehe der GAST-Trainer bei Team-Ueberlappung die Kontakte — dieser
  // Test wuerde dann rot. Nachgestellt: die Regel OHNE Schranke waere
  // `_coach_of_member === true`, was hier true ergaebe; die echte Regel ergibt
  // false. Der Unterschied IST die Schranke.
  it('sabotage check: the guest exclusion is what blocks the guest_coach', () => {
    const row = childRow(true);
    const realRule = maySeeContactOf(claims('guest_coach'), CLUB, row); // mit Schranke
    const withoutGuard = row._coach_of_member === true; // ohne Schranke
    expect(withoutGuard).toBe(true);
    expect(realRule).toBe(false);
  });
});
