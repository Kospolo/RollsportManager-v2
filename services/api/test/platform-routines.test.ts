// ============================================================================
// platform-routines.test.ts — GET /platform/routines (Kueren-Moderation).
//
// Eigene Datei statt Anhaengen an platform.test.ts: die Bestands-Datei gehoert
// dem Bestand, und parallel bauen gerade zwei andere Trupps an test/*. Zwei
// Dateien mergen sich; eine geaenderte Zeile in einem Array kollidiert.
//
// Kein Netz, keine DB: requirePlatformAdmin wirft 403 VOR jedem
// Datenbankzugriff, und die Zod-Validierung der Query laeuft noch davor. Damit
// ist alles hier in-process pruefbar. Der positive Pfad (200 + echte Zeilen)
// braucht eine Datenbank und ist im Bericht als Live-Beleg ausgewiesen.
//
// ### ZUSAMMENFUEHRUNG: die Naht zu Trupp 1 (0051) ###
// Diese Datei entstand, als es die Audit-Middleware noch nicht gab. Seit 0051
// haengt operatorAccess global an '*' und schreibt NACH jedem Request eines
// Plattform-Admins eine Protokollzeile — faellt der Schreib aus, wird die
// Antwort fail-closed durch 503 ersetzt. Ohne Datenbank traf das hier JEDE
// Anfrage mit Plattform-Token: aus dem erwarteten 400 wurde ein 503.
//
// Das ist kein Fehler der Middleware, sondern eine unvollstaendige Kulisse:
// in der Produktion GIBT es die Senke, die Protokollzeile geht durch, und der
// 400 kommt beim Aufrufer an. Der Mock unten stellt genau diese Senke nach —
// und NUR sie. Der Datenpfad der Route bleibt ohne Datenbank (er wirft
// weiterhin), damit der Test "der Handler laeuft wirklich" (>= 500) seine
// Aussage behaelt. Unterschieden wird am `reason`, den withServiceRole
// ohnehin verlangt.
// ============================================================================

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { resetConfigForTests } from '../src/config.js';
import { createApp } from '../src/app.js';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthEnv } from '../src/middleware/auth.js';

vi.mock('../src/db.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db.js')>();
  /** Nimmt jedes `tx\`insert …\`` an und liefert leer zurueck — wie eine leere Tabelle. */
  const sink = (): Promise<never[]> => Promise.resolve([]);
  return {
    ...actual,
    withServiceRole: async <T,>(reason: string, fn: (tx: unknown) => Promise<T>): Promise<T> => {
      // Nur die Audit-Senke aus middleware/operator-access.ts.
      if (reason.startsWith('operator audit log')) return fn(sink);
      // Alles andere (der Datenpfad der Route) bleibt bewusst ohne Datenbank.
      throw new Error('keine Datenbank im Unit-Test (Absicht, siehe Dateikopf)');
    },
  };
});

const TEST_SECRET = 'test-secret-for-vitest-0123456789abcdef';
const CLUB = '11111111-1111-4111-8111-111111111111';
const PATH = '/platform/routines';

async function sign(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience('authenticated')
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

let app: OpenAPIHono<AuthEnv>;
let ownerToken: string;
let adminToken: string;
let memberToken: string;
let coachToken: string;
let platformToken: string;

beforeAll(async () => {
  process.env['AUTH_MODE'] = 'dev';
  process.env['AUTH_JWT_SECRET'] = TEST_SECRET;
  process.env['AUTH_ISSUER'] = '';
  process.env['AUTH_AUDIENCE'] = 'authenticated';
  resetConfigForTests();
  app = createApp();
  ownerToken = await sign({ sub: '00000000-0000-4000-8000-000000000001', role: 'authenticated', club_roles: { [CLUB]: 'owner' } });
  adminToken = await sign({ sub: '00000000-0000-4000-8000-000000000002', role: 'authenticated', club_roles: { [CLUB]: 'admin' } });
  memberToken = await sign({ sub: '00000000-0000-4000-8000-000000000003', role: 'authenticated', club_roles: { [CLUB]: 'member' } });
  coachToken = await sign({ sub: '00000000-0000-4000-8000-000000000004', role: 'authenticated', club_roles: { [CLUB]: 'coach' } });
  // Die Plattform-Persona: KEINE club_roles — genau wie in echt.
  platformToken = await sign({
    sub: '00000000-0000-4000-8000-0000000000ff',
    role: 'authenticated',
    club_roles: {},
    app_metadata: { is_platform_admin: true },
  });
});

function get(path: string, token?: string): Response | Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return app.request(path, { method: 'GET', headers });
}

describe('GET /platform/routines: authentication', () => {
  it('rejects without a token (401)', async () => {
    expect((await get(PATH)).status).toBe(401);
  });
});

describe('GET /platform/routines: is_platform_admin only', () => {
  it('forbids owner, admin, coach and plain member alike (403, before any DB access)', async () => {
    for (const token of [ownerToken, adminToken, coachToken, memberToken]) {
      expect((await get(PATH, token)).status).toBe(403);
    }
  });

  it('forbids a club role even when it filters to its OWN club', async () => {
    // Die naheliegende Annahme waere: "der Trainer darf ja seine eigenen Kueren
    // sehen, also gib ihm wenigstens die". Nein — dafuer gibt es
    // GET /routines?club_id=. Diese Route ist die VEREINSUEBERGREIFENDE Sicht
    // im Service-Modus (RLS ist dort aus); ein Rollen-Zugang waere ein Loch,
    // das nur zufaellig durch den Filter zugehalten wird.
    expect((await get(`${PATH}?club_id=${CLUB}`, ownerToken)).status).toBe(403);
  });

  it('returns an RFC 7807 problem body on the 403', async () => {
    const res = await get(PATH, memberToken);
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { title: string; status: number };
    expect(body.title).toBe('Forbidden');
    expect(body.status).toBe(403);
  });
});

describe('GET /platform/routines: the route is actually wired up', () => {
  // Ohne diese beiden Faelle bewiese die 403-Suite nichts: eine NICHT
  // registrierte Route liefert 404, und ein Test, der nur "nicht 200" prueft,
  // waere auch dann gruen, wenn es die Route gar nicht gibt.

  it('is registered — a platform admin does NOT get 404', async () => {
    const res = await get(PATH, platformToken);
    expect(res.status).not.toBe(404);
    // Ohne Datenbank kommt hier ein 5xx aus withServiceRole — das ist der
    // Beweis, dass Guard UND Routing passiert sind und der Handler laeuft.
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('validates the query BEFORE the guard runs (bad club_id -> 400)', async () => {
    const res = await get(`${PATH}?club_id=not-a-uuid`, platformToken);
    expect(res.status).toBe(400);
  });

  it('rejects an unknown status value (400)', async () => {
    const res = await get(`${PATH}?status=beschlagnahmt`, platformToken);
    expect(res.status).toBe(400);
  });
});

describe('GET /platform/routines: appears in the OpenAPI contract', () => {
  // Der Codegen laeuft erst beim Zusammenfuehren. Dieser Test haelt fest, dass
  // die Route dann auch WIRKLICH im Vertrag landet — sonst faellt es erst auf,
  // wenn der Web-Client die von Hand getippte Wire-Form nicht mehr los wird.
  it('exposes the path with its query parameters and the PlatformRoutineRow schema', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      paths: Record<string, Record<string, { parameters?: { name: string }[] }>>;
      components: { schemas: Record<string, unknown> };
    };
    const op = doc.paths[PATH]?.['get'];
    expect(op).toBeDefined();
    const params = (op?.parameters ?? []).map((p) => p.name);
    expect(params).toEqual(expect.arrayContaining(['club_id', 'status', 'q', 'limit', 'offset']));
    expect(doc.components.schemas['PlatformRoutineRow']).toBeDefined();
  });
});
