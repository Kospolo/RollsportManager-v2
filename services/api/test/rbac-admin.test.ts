// ============================================================================
// rbac-admin.test.ts — die Contract-Seite der Rechte-Verwaltung (Phase 3).
//
// Was hier NICHT geprueft wird: ob die Etiketten inhaltlich stimmen ("wirkt
// 'none' bei finance wirklich nur halb?"). Das ist eine Aussage ueber POLICIES
// und wird dort nachgerechnet, wo die Policies liegen:
// supabase/tests/sql/93j_capability_enforcement.sql (Block B–E).
//
// Hier geht es um das, was TypeScript selbst verantwortet: dass die Felder, von
// denen die WAHRHEITSGEMAESSE Beschriftung im UI abhaengt, nicht stillschweigend
// fehlen duerfen. Genau das ist der Fehlermodus, um den es geht — nicht ein
// falsches Etikett, sondern GAR KEINS, das der Client dann durch eine huebsche
// Annahme ersetzt.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  capabilityEnforcementSchema,
  capabilitySchema,
  memberRoleAssignmentSchema,
  resolvedCapabilitySchema,
} from '../src/lib/validation.js';

const CLUB = '11111111-1111-4111-8111-111111111111';
const MEMBER = '44444444-4444-4444-8444-444444444444';
const ROLE_A = '55555555-5555-4555-8555-555555555555';
const ROLE_B = '66666666-6666-4666-8666-666666666666';

/** Ein vollstaendiger Katalog-Eintrag, wie GET /capabilities ihn liefert. */
const capability = {
  key: 'lockers',
  label_de: 'Schließfächer',
  label_en: 'Lockers',
  allowed_levels: ['none', 'read_own', 'read_all', 'manage'],
  sort: 260,
  owner_only: true,
  enforcement: 'enforced',
};

describe('capabilityEnforcementSchema (0033) — das Etikett hinter der Stufe', () => {
  it('kennt genau die vier Werte des DB-Enums app.cap_enforcement', () => {
    expect(capabilityEnforcementSchema.options).toEqual([
      'enforced',
      'partial',
      'write_only',
      'unenforced',
    ]);
  });

  it('weist einen erfundenen Wert ab (ein Etikett, das kein Client kennt, ist keins)', () => {
    expect(capabilityEnforcementSchema.safeParse('mostly').success).toBe(false);
  });
});

describe('capabilitySchema — der Katalog fuer das Admin-UI', () => {
  it('nimmt einen vollstaendigen Eintrag an', () => {
    const parsed = capabilitySchema.parse(capability);
    expect(parsed.owner_only).toBe(true);
    expect(parsed.enforcement).toBe('enforced');
  });

  // Der eigentliche Punkt dieser Suite. Faellt jemand in roles.ts auf das alte
  // `select key, label_de, label_en, allowed_levels, sort` zurueck, MUSS die
  // Antwort hier zerbrechen — nicht stillschweigend ein Feld weglassen, auf das
  // sich die Beschriftung stuetzt. Ohne enforcement kann das UI "keine" nicht
  // von "keine (wirkt nicht)" unterscheiden; ohne owner_only baut es ein
  // Dropdown, das beim Speichern 403 liefert (roles.ts:404-415).
  it('LEHNT einen Eintrag ohne enforcement ab (sonst raet das UI die Beschriftung)', () => {
    const { enforcement: _drop, ...ohne } = capability;
    expect(capabilitySchema.safeParse(ohne).success).toBe(false);
  });

  it('LEHNT einen Eintrag ohne owner_only ab (sonst baut das UI ein 403-Dropdown)', () => {
    const { owner_only: _drop, ...ohne } = capability;
    expect(capabilitySchema.safeParse(ohne).success).toBe(false);
  });

  it('LEHNT eine Stufe ausserhalb der Skala ab', () => {
    expect(
      capabilitySchema.safeParse({ ...capability, allowed_levels: ['none', 'lesen'] }).success,
    ).toBe(false);
  });
});

describe('resolvedCapabilitySchema — GET /me/capabilities', () => {
  const resolved = {
    capability_key: 'finance',
    label_de: 'Finanzen',
    label_en: 'Finance',
    allowed_levels: ['none', 'read_own', 'manage'],
    sort: 270,
    rank: 5,
    level: 'manage',
    owner_only: true,
    enforcement: 'partial',
  };

  it('nimmt eine vollstaendige Aufloesung an', () => {
    expect(resolvedCapabilitySchema.parse(resolved).enforcement).toBe('partial');
  });

  it('LEHNT eine Aufloesung ohne enforcement ab', () => {
    const { enforcement: _drop, ...ohne } = resolved;
    expect(resolvedCapabilitySchema.safeParse(ohne).success).toBe(false);
  });

  // rank und level duerfen auseinanderfallen — das ist seit 0032 AUSDRUECKLICH
  // so (protected owner: rank 5 = Durchsetzung, level = dieselbe Berechtigung
  // auf der Skala der Faehigkeit). Ein Schema, das hier Gleichheit erzwaenge,
  // wuerde die Antwort fuer den Vereinsinhaber auf 17 von 32 Faehigkeiten
  // zerbrechen. Diese Zeile haelt fest, dass das Absicht ist.
  it('erlaubt rank=5 bei level=read_all (der protected-Kurzschluss, 0032)', () => {
    const parsed = resolvedCapabilitySchema.parse({
      ...resolved,
      capability_key: 'member_contact',
      allowed_levels: ['none', 'read_all'],
      rank: 5,
      level: 'read_all',
    });
    expect(parsed.rank).toBe(5);
    expect(parsed.level).toBe('read_all');
  });
});

describe('memberRoleAssignmentSchema — die Leseseite der Mehrfachrollen', () => {
  it('nimmt eine Person mit mehreren Rollen an', () => {
    const parsed = memberRoleAssignmentSchema.parse({
      member_id: MEMBER,
      role_ids: [ROLE_A, ROLE_B],
    });
    expect(parsed.role_ids).toHaveLength(2);
  });

  it('nimmt eine leere Rollenliste an (die Person hat schlicht keine)', () => {
    expect(
      memberRoleAssignmentSchema.safeParse({ member_id: MEMBER, role_ids: [] }).success,
    ).toBe(true);
  });

  it('LEHNT eine Rollen-Id ab, die keine uuid ist', () => {
    expect(
      memberRoleAssignmentSchema.safeParse({ member_id: MEMBER, role_ids: ['moderator'] }).success,
    ).toBe(false);
  });

  it('LEHNT eine Zeile ohne member_id ab', () => {
    expect(memberRoleAssignmentSchema.safeParse({ role_ids: [ROLE_A] }).success).toBe(false);
  });

  it('verwechselt club_id nicht mit member_id (beides uuid — Reihenfolge zaehlt)', () => {
    const parsed = memberRoleAssignmentSchema.parse({ member_id: CLUB, role_ids: [] });
    expect(parsed.member_id).toBe(CLUB);
  });
});
