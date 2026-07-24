// ============================================================================
// operator-zweckbindung.test.ts — die Zweckbindung in der TYPESCRIPT-Schicht
// (Migration 0075). Reine Funktionen, keine Datenbank.
//
// Warum es diesen Test braucht, obwohl 99e/99q die DB-Seite beweisen:
// die Kontaktdaten-Maskierung des Rosters ist ein reiner TS-Gate. SQL kommt
// dort nie vorbei — 99q kann also gar nicht sehen, ob der Betreiber
// birth_date/phone/postal_address bekommt. Genau in dieser Luecke sass der
// belegte Befund: /coach-notes und /locker-rentals waren zu, und ueber
// GET /clubs/{id}/members lief das Geburtsdatum von 15 Minderjaehrigen und
// Telefon + Anschrift von 5 heraus.
//
// GEMESSEN WIRD DER ECHTE ZUSTAND: Claim UND eingeschaltete Einsicht
// (markOperatorAccess) — genau das, was middleware/operator-access.ts vor
// jedem Request eines Plattform-Tokens tut. Ein Test, der nur den Claim setzt,
// misst am laufenden System vorbei.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { authClaimsSchema } from '../src/middleware/auth.js';
import { markOperatorAccess } from '../src/lib/operator-context.js';
import { OPERATOR_CAPABILITIES, operatorMay } from '../src/lib/operator-capabilities.js';
import {
  ADMIN_ROLES,
  COACH_ROLES,
  MANAGE_MEMBER_ROLES,
  clubRoleHeld,
  hasClubRole,
  isClubMember,
} from '../src/lib/guards.js';
import {
  maySeeContactOf,
  maySeeFullRoster,
  maySeeInternalSelfProfile,
  maySeeJoinedOn,
  redactMemberForViewer,
} from '../src/routes/members.js';
import type { AuthClaims } from '../src/middleware/auth.js';

const CLUB = '11111111-1111-4111-8111-111111111111';

/** Plattform-Token OHNE eingeschaltete Einsicht (Middleware nicht gelaufen). */
function claimOnly(): AuthClaims {
  return authClaimsSchema.parse({
    sub: '90000000-0000-4000-8000-000000000090',
    role: 'authenticated',
    club_roles: {},
    app_metadata: { is_platform_admin: true },
  });
}

/** DER ECHTE BETRIEBSZUSTAND: Claim + protokollierte, eingeschaltete Einsicht. */
function operator(): AuthClaims {
  const claims = claimOnly();
  markOperatorAccess(claims);
  return claims;
}

/** Gegenprobe nach oben: der Vereinsvorstand. */
function owner(): AuthClaims {
  return authClaimsSchema.parse({
    sub: '90000000-0000-4000-8000-000000000002',
    role: 'authenticated',
    club_roles: { [CLUB]: 'owner' },
  });
}

/** Gegenprobe nach unten: ein einfaches Mitglied. */
function member(): AuthClaims {
  return authClaimsSchema.parse({
    sub: '90000000-0000-4000-8000-000000000009',
    role: 'authenticated',
    club_roles: { [CLUB]: 'member' },
  });
}

// ---------------------------------------------------------------------------
// 1. operatorMay — dasselbe Verhalten wie app.operator_may in SQL.
// ---------------------------------------------------------------------------
describe('operatorMay: der Schalter verlangt BEIDES', () => {
  it('der blosse Plattform-Claim bewirkt nichts — auch bei freigegebener Faehigkeit', () => {
    expect(operatorMay(claimOnly(), 'members')).toBe(false);
    expect(operatorMay(claimOnly(), 'routines')).toBe(false);
  });

  it('eingeschaltete Einsicht + freigegebene Faehigkeit = true', () => {
    expect(operatorMay(operator(), 'members')).toBe(true);
    expect(operatorMay(operator(), 'routines_edit')).toBe(true);
  });

  it('eingeschaltete Einsicht + GESPERRTE Faehigkeit = false (fail-closed)', () => {
    for (const cap of ['member_contact', 'lockers', 'coach_notes', 'finance', 'checkins'] as const) {
      expect(operatorMay(operator(), cap)).toBe(false);
    }
  });

  it('eine unbekannte/neue Faehigkeit ist automatisch gesperrt (Art. 25 Abs. 2)', () => {
    // Das ist die eigentliche Zusage der Allowlist: Migration 0080 fuehrt
    // 'gesundheitsdaten' ein, niemand denkt an diese Datei — und der Betreiber
    // sieht trotzdem nichts.
    expect(operatorMay(operator(), 'gesundheitsdaten' as never)).toBe(false);
  });

  it('ein normales Mitglied kann den Schalter nicht ausloesen', () => {
    expect(operatorMay(member(), 'members')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. hasClubRole — der Zweig, in dem der Befund sass.
// ---------------------------------------------------------------------------
describe('hasClubRole: ohne genannte Faehigkeit gibt es keinen Betreiber-Zweig', () => {
  it('OHNE Faehigkeit ist der Betreiber wie jede nicht berechtigte Rolle: false', () => {
    // Vor 0075 lieferte diese Zeile fuer JEDE Rollenliste true.
    expect(hasClubRole(operator(), CLUB, MANAGE_MEMBER_ROLES)).toBe(false);
    expect(hasClubRole(operator(), CLUB, ADMIN_ROLES)).toBe(false);
    expect(hasClubRole(operator(), CLUB, COACH_ROLES)).toBe(false);
  });

  it('MIT gesperrter Faehigkeit ebenfalls false', () => {
    expect(hasClubRole(operator(), CLUB, MANAGE_MEMBER_ROLES, 'member_contact')).toBe(false);
    expect(hasClubRole(operator(), CLUB, COACH_ROLES, 'lockers')).toBe(false);
  });

  it('MIT freigegebener Faehigkeit true — die Kueren-Moderation lebt weiter', () => {
    expect(hasClubRole(operator(), CLUB, COACH_ROLES, 'routines_edit')).toBe(true);
    expect(hasClubRole(operator(), CLUB, ADMIN_ROLES, 'club_settings')).toBe(true);
  });

  it('das Vereinsleben aendert sich um kein Bisschen', () => {
    expect(hasClubRole(owner(), CLUB, MANAGE_MEMBER_ROLES)).toBe(true);
    expect(hasClubRole(owner(), CLUB, MANAGE_MEMBER_ROLES, 'member_contact')).toBe(true);
    expect(hasClubRole(member(), CLUB, MANAGE_MEMBER_ROLES)).toBe(false);
    expect(hasClubRole(member(), CLUB, MANAGE_MEMBER_ROLES, 'member_contact')).toBe(false);
  });

  it('wer BEIDES ist (Plattform-Admin UND Vereinsrolle), behaelt seine echte Rolle', () => {
    // Der Grund, warum die Verknuepfung ODER ist und kein CASE — dieselbe
    // Ueberlegung wie in 0074, Abschnitt 6. Diese Person gibt es im Seed nicht,
    // aber die Bauform darf sie nicht bestrafen.
    const both = authClaimsSchema.parse({
      sub: '90000000-0000-4000-8000-000000000090',
      role: 'authenticated',
      club_roles: { [CLUB]: 'treasurer' },
      app_metadata: { is_platform_admin: true },
    });
    markOperatorAccess(both);
    expect(hasClubRole(both, CLUB, MANAGE_MEMBER_ROLES, 'member_contact')).toBe(true);
  });

  it('clubRoleHeld kennt ueberhaupt keinen Betreiber-Zweig (Tatsache, keine Befugnis)', () => {
    expect(clubRoleHeld(operator(), CLUB, ADMIN_ROLES)).toBe(false);
    expect(clubRoleHeld(owner(), CLUB, ADMIN_ROLES)).toBe(true);
  });

  it('isClubMember bleibt an die freigegebene Faehigkeit members gebunden', () => {
    expect(isClubMember(operator(), CLUB)).toBe(true);
    expect(isClubMember(claimOnly(), CLUB)).toBe(false); // Claim allein: nein
    expect(isClubMember(member(), CLUB)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. DER BEFUND SELBST: die Roster-Maskierung greift jetzt fuer den Betreiber.
// ---------------------------------------------------------------------------
describe('Roster-Maskierung: der Betreiber sieht keine Kontaktdaten von Kindern', () => {
  /** Eine Zeile wie sie die Roster-Abfrage liefert — Kind, 2015 geboren. */
  const kindRow = () => ({
    id: 'a0000000-0000-4000-8000-000000000023',
    first_name: 'Hanna',
    last_name: 'Foerster',
    birth_date: '2015-04-11',
    email: 'eltern.foerster@example.org',
    phone: '+49 160 1234567',
    postal_address: 'Beethovenstr. 24, 74172 Neckarsulm',
    joined_on: '2021-09-01',
    valid_until: null,
    profile_id: null,
    profile_visibility: 'internal',
    profile_motto: 'Immer weiter',
    profile_favorite_discipline: 'Kuer',
    profile_skating_since: 2021,
    _coach_of_member: false,
    _self_or_guardian: false,
  });

  it('maySeeFullRoster ist fuer den Betreiber false (member_contact ist gesperrt)', () => {
    expect(maySeeFullRoster(operator(), CLUB)).toBe(false);
    expect(maySeeFullRoster(owner(), CLUB)).toBe(true);
    expect(maySeeFullRoster(member(), CLUB)).toBe(false);
  });

  it('maySeeContactOf ist fuer den Betreiber false — auch zeilenweise', () => {
    expect(maySeeContactOf(operator(), CLUB, kindRow())).toBe(false);
    // und auch dann nicht, wenn die Zeile den Trainer-Schnitt traegt: der
    // Betreiber ist kein coach (clubRoleHeld).
    expect(maySeeContactOf(operator(), CLUB, { ...kindRow(), _coach_of_member: true })).toBe(false);
  });

  it('Geburtsdatum, Telefon und Anschrift kommen als null zurueck', () => {
    const out = redactMemberForViewer(
      kindRow(),
      maySeeFullRoster(operator(), CLUB),
      maySeeJoinedOn(operator(), CLUB),
      maySeeContactOf(operator(), CLUB, kindRow()),
    );
    expect(out.birth_date).toBeNull();
    expect(out.phone).toBeNull();
    expect(out.postal_address).toBeNull();
    expect(out.email).toBeNull();
    expect(out.profile_id).toBeNull();
    // Der Name bleibt: 'members' ist freigegeben, ohne Stammdaten ist kein
    // Support-Fall bearbeitbar (0074). Die Grenze ist der KONTAKT, nicht die Existenz.
    expect(out.first_name).toBe('Hanna');
  });

  it('GEGENPROBE: fuer den Vorstand steht alles unveraendert drin', () => {
    const out = redactMemberForViewer(
      kindRow(),
      maySeeFullRoster(owner(), CLUB),
      maySeeJoinedOn(owner(), CLUB),
      maySeeContactOf(owner(), CLUB, kindRow()),
    );
    expect(out.birth_date).toBe('2015-04-11');
    expect(out.phone).toBe('+49 160 1234567');
    expect(out.postal_address).toBe('Beethovenstr. 24, 74172 Neckarsulm');
  });

  it('GEGENPROBE: ein einfaches Mitglied bekommt dieselben Felder als null', () => {
    // Der Betreiber steht damit genau dort, wo jede andere nicht berechtigte
    // Rolle steht — das war die Zusage.
    const asMember = redactMemberForViewer(
      kindRow(),
      maySeeFullRoster(member(), CLUB),
      maySeeJoinedOn(member(), CLUB),
      maySeeContactOf(member(), CLUB, kindRow()),
    );
    const asOperator = redactMemberForViewer(
      kindRow(),
      maySeeFullRoster(operator(), CLUB),
      maySeeJoinedOn(operator(), CLUB),
      maySeeContactOf(operator(), CLUB, kindRow()),
    );
    for (const field of ['birth_date', 'email', 'phone', 'postal_address', 'profile_id'] as const) {
      expect(asOperator[field]).toBe(asMember[field]);
    }
  });

  it('das Selbst-Profil („intern") bleibt dem Betreiber ebenfalls verschlossen', () => {
    expect(maySeeInternalSelfProfile(operator(), CLUB)).toBe(false);
    expect(maySeeInternalSelfProfile(owner(), CLUB)).toBe(true);
  });

  it('joined_on/Jubilaeen bleiben offen — 0074 hat anniversaries ausdruecklich freigegeben', () => {
    // Bewusst KEINE Verschaerfung: die Jubilaeumsliste ist rein aus members
    // abgeleitet, das ohnehin freigegeben ist. Eine Sperre haette hier nichts
    // geschuetzt, nur eine Auswertung zerbrochen (0074, Begruendung zur Zeile).
    expect(maySeeJoinedOn(operator(), CLUB)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Die Liste selbst: klein, benannt, und ohne die gesperrten Schluessel.
// ---------------------------------------------------------------------------
describe('die Allowlist in TypeScript', () => {
  it('enthaelt genau die neun Faehigkeiten aus 0074', () => {
    expect([...OPERATOR_CAPABILITIES].sort()).toEqual([
      'anniversaries',
      'club_settings',
      'departments',
      'members',
      'roles',
      'routines',
      'routines_edit',
      'team_coaches',
      'teams',
    ]);
  });

  it('enthaelt keine der namentlich gesperrten', () => {
    for (const cap of [
      'coach_notes',
      'lockers',
      'finance',
      'member_contact',
      'attendance',
      'checkins',
      'chat',
    ]) {
      expect(OPERATOR_CAPABILITIES.has(cap)).toBe(false);
    }
  });
});
