// ============================================================================
// capabilities.test.ts — die TS-Seite der RBAC-Aufloesung.
//
// Was hier NICHT geprueft wird: ob die Raenge stimmen. Die kommen aus der
// Datenbank (app.cap_ranks) und werden dort getestet (93e_rbac_resolution.sql)
// bzw. ueber HTTP in scripts/smoke.mjs. Hier geht es um die drei Dinge, die
// TypeScript selbst verantwortet:
//   1. die Skala (rankOf/levelOfRank) — die einzige TS-Kodierung der Rangfolge
//   2. die Memoisierung (eine Transaktion je Request+Verein, kein Leak ueber
//      Requests hinweg — ein prozessweiter Cache waere genau der Fehler, den
//      0025 in der DB gerade behoben hat)
//   3. requireCap: 403 mit bilingualem Text, fail-closed bei fehlendem Key
// ============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

// withUser wird gemockt: diese Suite laeuft ohne Datenbank. Der Mock zaehlt
// zugleich die Aufrufe — das ist der Memoisierungs-Beweis.
const withUserMock = vi.fn();
vi.mock('../src/db.js', () => ({
  withUser: (claims: unknown, fn: unknown) => withUserMock(claims, fn),
}));

const {
  CAPABILITY_LEVELS,
  rankOf,
  levelOfRank,
  capsFor,
  capRankOf,
  requireCap,
  isClubMemberInDb,
} = await import('../src/lib/capabilities.js');
const { ProblemError } = await import('../src/middleware/error.js');
type CapabilityLevel = (typeof CAPABILITY_LEVELS)[number];

const CLUB = '11111111-1111-4111-8111-111111111111';
const OTHER_CLUB = '33333333-3333-4333-8333-333333333333';

/** Ein minimaler Hono-Context-Doppelgaenger: capsFor braucht nur get('claims'). */
function fakeCtx(): { get: (k: string) => unknown } {
  return {
    get: (k: string) =>
      k === 'claims'
        ? { sub: '22222222-2222-4222-8222-222222222222', role: 'authenticated', club_roles: {} }
        : undefined,
  };
}

function capsResult(ranks: Record<string, number>, roleKeys: string[] = ['member']) {
  return {
    roleKeys,
    ranks: new Map(Object.entries(ranks)),
    caps: [],
  };
}

beforeEach(() => {
  withUserMock.mockReset();
});

describe('die Stufen-Skala (= app.role_level / app.level_rank)', () => {
  it('hat exakt die 6 Werte des DB-Enums, in der Reihenfolge des Rangs', () => {
    expect([...CAPABILITY_LEVELS]).toEqual([
      'none',
      'read_own',
      'read_team',
      'read_all',
      'edit',
      'manage',
    ]);
  });

  it('rankOf bildet none=0 … manage=5 ab (identisch zu app.level_rank 0022:37-52)', () => {
    expect(rankOf('none')).toBe(0);
    expect(rankOf('read_own')).toBe(1);
    expect(rankOf('read_team')).toBe(2);
    expect(rankOf('read_all')).toBe(3);
    expect(rankOf('edit')).toBe(4);
    expect(rankOf('manage')).toBe(5);
  });

  it('ist geordnet: jeder Rang ist groesser als sein Vorgaenger', () => {
    for (let i = 1; i < CAPABILITY_LEVELS.length; i += 1) {
      expect(rankOf(CAPABILITY_LEVELS[i] as CapabilityLevel)).toBeGreaterThan(
        rankOf(CAPABILITY_LEVELS[i - 1] as CapabilityLevel),
      );
    }
  });

  it('levelOfRank ist die Umkehrung von rankOf (der Vertrag aus 93e)', () => {
    for (const level of CAPABILITY_LEVELS) {
      expect(levelOfRank(rankOf(level))).toBe(level);
    }
  });

  it('levelOfRank liefert bei unbekanntem Rang undefined (fail-closed)', () => {
    expect(levelOfRank(9)).toBeUndefined();
    expect(levelOfRank(-1)).toBeUndefined();
  });
});

describe('capsFor — Memoisierung je (Request, Verein)', () => {
  it('laedt EINMAL je Verein und Request, nicht je Guard', async () => {
    withUserMock.mockResolvedValue(capsResult({ finance: 5 }));
    const c = fakeCtx() as never;

    await capsFor(c, CLUB);
    await capsFor(c, CLUB);
    await capRankOf(c, CLUB, 'finance');

    expect(withUserMock).toHaveBeenCalledTimes(1);
  });

  it('haelt Vereine getrennt — sonst leckten Rechte ueber Mandanten hinweg', async () => {
    withUserMock.mockResolvedValue(capsResult({ finance: 5 }));
    const c = fakeCtx() as never;

    await capsFor(c, CLUB);
    await capsFor(c, OTHER_CLUB);

    expect(withUserMock).toHaveBeenCalledTimes(2);
  });

  it('teilt NICHTS zwischen zwei Requests — ein prozessweiter Cache lieferte veraltete Rechte', async () => {
    withUserMock.mockResolvedValue(capsResult({ finance: 5 }));

    await capsFor(fakeCtx() as never, CLUB);
    await capsFor(fakeCtx() as never, CLUB);

    expect(withUserMock).toHaveBeenCalledTimes(2);
  });
});

describe('capRankOf / requireCap', () => {
  it('liefert 0 fuer eine unbekannte Faehigkeit (fail-closed, kein stiller Vollzugriff)', async () => {
    withUserMock.mockResolvedValue(capsResult({ finance: 5 }));
    await expect(capRankOf(fakeCtx() as never, CLUB, 'gibt_es_nicht')).resolves.toBe(0);
  });

  it('laesst durch, wenn der Rang die Mindeststufe erreicht ODER uebersteigt', async () => {
    withUserMock.mockResolvedValue(capsResult({ finance: 5, attendance: 4 }));
    const c = fakeCtx() as never;
    await expect(requireCap(c, CLUB, 'finance', 'manage')).resolves.toBeUndefined();
    await expect(requireCap(c, CLUB, 'finance', 'read_own')).resolves.toBeUndefined();
    await expect(requireCap(c, CLUB, 'attendance', 'edit')).resolves.toBeUndefined();
  });

  it('wirft 403, wenn der Rang darunter liegt', async () => {
    withUserMock.mockResolvedValue(capsResult({ finance: 3 }));
    await expect(requireCap(fakeCtx() as never, CLUB, 'finance', 'manage')).rejects.toBeInstanceOf(
      ProblemError,
    );
    withUserMock.mockResolvedValue(capsResult({ finance: 3 }));
    await requireCap(fakeCtx() as never, CLUB, 'finance', 'manage').catch((e: unknown) => {
      expect((e as InstanceType<typeof ProblemError>).status).toBe(403);
    });
  });

  it('begruendet den 403 bilingual (DE + EN) und nennt Faehigkeit + Stufe', async () => {
    withUserMock.mockResolvedValue(capsResult({ finance: 0 }));
    await requireCap(fakeCtx() as never, CLUB, 'finance', 'manage').catch((e: unknown) => {
      const detail = (e as InstanceType<typeof ProblemError>).detail ?? '';
      expect(detail).toContain('Fehlende Berechtigung');
      expect(detail).toContain('Missing permission');
      expect(detail).toContain('finance');
      expect(detail).toContain('manage');
    });
    expect.assertions(4);
  });

  it('none (0) reicht nie fuer read_own (1) — die unterste Schranke haelt', async () => {
    withUserMock.mockResolvedValue(capsResult({ lockers: 0 }));
    await expect(requireCap(fakeCtx() as never, CLUB, 'lockers', 'read_own')).rejects.toBeInstanceOf(
      ProblemError,
    );
  });
});

describe('isClubMemberInDb', () => {
  it('ist wahr, sobald die DB mindestens eine Rolle liefert', async () => {
    withUserMock.mockResolvedValue(capsResult({}, ['member', 'coach']));
    await expect(isClubMemberInDb(fakeCtx() as never, CLUB)).resolves.toBe(true);
  });

  it('ist falsch bei leeren roleKeys — das ist der Mitgliedschafts-Gate aus 0025', async () => {
    withUserMock.mockResolvedValue(capsResult({}, []));
    await expect(isClubMemberInDb(fakeCtx() as never, CLUB)).resolves.toBe(false);
  });
});
