// ============================================================================
// operator-audit-fail-closed.test.ts — „KEIN ZUGRIFF OHNE EINTRAG", gemessen.
//
// ### Warum diese Datei existiert ###
// middleware/operator-access.ts sagt in ihrem Kopf zu: schlaegt der
// Protokoll-Schreib fehl, wird die ANTWORT VERWORFEN und 503 geliefert — „der
// Betreiber bekommt die Daten also nur zu sehen, wenn die Protokollzeile
// steht". Das war bislang eine Zusage im Kommentar und sonst nirgends. Genau
// solche Zusagen sind die, die bei der naechsten Umbaute still verloren gehen:
// ein `catch` weniger, und die Kinderdaten gehen unprotokolliert hinaus,
// waehrend alle Tests gruen bleiben.
//
// Der Fall ist NUR hier pruefbar. Die SQL-Suiten sehen die Middleware nicht,
// und api-db-test.sh kann den Protokoll-Schreib nicht zum Scheitern bringen,
// ohne die ganze Datenbank umzuwerfen. Hier genuegt ein Mock.
//
// Gemessen wird nicht nur der Statuscode, sondern dass der NUTZLASTTEXT die
// Antwort nicht verlaesst — ein 503 mit den Daten im Rumpf waere die
// schlechteste aller Welten.
// ============================================================================

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Der Protokoll-Schreib laeuft ueber withServiceRole (db.ts). Nur DAS wird
// ersetzt — die Middleware selbst laeuft unveraendert.
const withServiceRole = vi.fn();
vi.mock('../src/db.js', () => ({
  withServiceRole: (reason: string, fn: unknown) => withServiceRole(reason, fn),
}));

const { operatorAccess } = await import('../src/middleware/operator-access.js');
const { authClaimsSchema } = await import('../src/middleware/auth.js');

const GEHEIM = 'interne-notiz-ueber-ein-kind';
const CLUB = 'c1ab0000-0000-4000-8000-000000000001';

function appWith(claims: unknown) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('claims' as never, claims as never);
    c.set('requestId' as never, 'req-test' as never);
    await next();
  });
  app.use('*', operatorAccess);
  app.get('/coach-notes', (c) => c.json({ body: GEHEIM }));
  return app;
}

const platformClaims = () =>
  authClaimsSchema.parse({
    sub: '90000000-0000-4000-8000-000000000090',
    role: 'authenticated',
    club_roles: {},
    app_metadata: { is_platform_admin: true },
  });

const memberClaims = () =>
  authClaimsSchema.parse({
    sub: '90000000-0000-4000-8000-000000000009',
    role: 'authenticated',
    club_roles: { [CLUB]: 'member' },
  });

beforeEach(() => {
  withServiceRole.mockReset();
});

describe('Betreiber-Protokoll: kein Zugriff ohne Eintrag', () => {
  it('GEGENPROBE: steht die Protokollzeile, kommen die Daten durch', async () => {
    withServiceRole.mockResolvedValue(undefined);
    const res = await appWith(platformClaims()).request('/coach-notes');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(GEHEIM);
    // … und die Zeile wurde wirklich geschrieben, nicht nur nicht verweigert.
    expect(withServiceRole).toHaveBeenCalledTimes(1);
    expect(withServiceRole.mock.calls[0]?.[0]).toContain('Art. 28');
  });

  it('DER KERN: scheitert der Protokoll-Schreib, verlaesst die Nutzlast den Prozess NICHT', async () => {
    withServiceRole.mockRejectedValue(new Error('audit log unreachable'));
    const res = await appWith(platformClaims()).request('/coach-notes');
    expect(res.status).toBe(503);
    const text = await res.text();
    // Die eigentliche Zusicherung: nicht „ein Fehlercode", sondern „die Daten
    // sind nicht drin".
    expect(text).not.toContain(GEHEIM);
    expect(text).toContain('Protokoll');
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  it('GEGENPROBE 2: ein normales Mitglied erzeugt gar keine Protokollzeile', async () => {
    // Das Protokoll ist ein BETREIBER-Protokoll. Wuerde es jeden Request
    // mitschreiben, waere es selbst eine Datensammlung ohne Rechtsgrundlage —
    // und der Ausfall des Protokolls wuerde die ganze App lahmlegen.
    const res = await appWith(memberClaims()).request('/coach-notes');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(GEHEIM);
    expect(withServiceRole).not.toHaveBeenCalled();
  });

  it('… und ein Ausfall des Protokolls beruehrt normale Nutzer nicht', async () => {
    withServiceRole.mockRejectedValue(new Error('audit log unreachable'));
    const res = await appWith(memberClaims()).request('/coach-notes');
    expect(res.status).toBe(200);
  });
});
