// ============================================================================
// middleware/operator-access.ts — der Betreiber-Zugriff UND sein Protokoll,
// untrennbar in EINER Middleware.
//
// ### Die eine Anforderung, die alles andere formt ###
// "Das Protokollieren darf nicht vergessen werden koennen." Ein Audit-Log, das
// an 40 Aufrufstellen von Hand eingestreut wird, ist nach drei Wochen
// lueckenhaft — und ein lueckenhaftes Protokoll ist als Nachweis nach
// Art. 28 Abs. 3 lit. h DSGVO wertlos. Deshalb steht hier NICHTS pro Route.
//
// Die Konstruktion macht das Vergessen unmoeglich, statt es zu verbieten:
//   * DIESE Middleware ist die EINZIGE Stelle, die markOperatorAccess() ruft.
//   * Ohne diese Markierung setzt db.ts die Variable app.operator_override
//     nicht -> app.operator_override() ist false -> cap_rank/has_club_role
//     verhalten sich fuer den Betreiber exakt wie vor 0051 (403, ausgesperrt).
// Wer also eine neue Betreiber-Route baut und "das Protokoll vergisst", baut
// keine unprotokollierte Route — er baut eine Route, die nicht funktioniert.
// Der Zugriff und sein Nachweis haengen an derselben Zeile Code.
//
// ### Warum das Protokoll NACH dem Handler geschrieben wird ###
// Weil erst dann das Ergebnis feststeht (status), und weil die Tabelle
// append-only ist (0051): ein spaeteres Nachtragen per UPDATE gibt es nicht —
// das ist Absicht, nicht Bequemlichkeit.
// Die Reihenfolge ist trotzdem fail-closed: schlaegt der Protokoll-Schreib fehl,
// wird die ANTWORT VERWORFEN und 503 geliefert. Der Betreiber bekommt die Daten
// also nur zu sehen, wenn die Protokollzeile steht. "Kein Einblick ohne
// Nachweis" ist damit keine Absichtserklaerung, sondern der Kontrollfluss.
//
// EHRLICHE GRENZE (nicht wegdiskutiert): bei einer SCHREIBENDEN Route ist die
// Aenderung bereits committet, wenn das Protokoll scheitert. Der Aufrufer
// bekommt 503 und die Antwort wird verworfen, aber die Schreibung bleibt —
// unprotokolliert. Diese Luecke ist real und schliesst sich nur, wenn Fach- und
// Protokoll-Schreibung in DERSELBEN Transaktion liegen; dafuer muesste jede
// Route ihre Transaktion an die Middleware reichen, und genau das waere wieder
// die 40-Aufrufstellen-Loesung, die oben ausgeschlossen ist. Bewusst so
// gewaehlt, hier benannt, im Bericht genannt.
// ============================================================================

import { createMiddleware } from 'hono/factory';
import { withServiceRole } from '../db.js';
import { isPlatformAdmin } from '../lib/guards.js';
import { markOperatorAccess } from '../lib/operator-context.js';
import type { AuthEnv, AuthClaims } from './auth.js';

/** HTTP-Methoden ohne Seiteneffekt (RFC 9110 §9.2.1). Alles andere ist 'write'. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Wie oft die Loeschfrist nebenbei durchgesetzt wird (siehe 0051: kein pg_cron
 * in diesem Stack). 1 von 50 Betreiber-Zugriffen raeumt auf — haeufig genug,
 * dass die Frist real ist, selten genug, dass sie nichts kostet.
 */
const PURGE_EVERY = 50;
let auditWrites = 0;

/**
 * Die Vereins-Zuordnung eines Zugriffs.
 *
 * Reihenfolge = Verlaesslichkeit: der Pfad-Parameter ist die klarste Aussage,
 * danach die Query (/routines?club_id=…), zuletzt der Body (POST /routines).
 * Findet sich nichts, ist club_id null — das ist KEIN Fehler, sondern der
 * Normalfall der reinen Betreiber-Konsole (/platform/stats). Auch die wird
 * protokolliert (Zeile mit club_id = null): was der Betreiber tut, steht
 * vollstaendig im Protokoll, nicht nur die Teile, die wir zuordnen konnten.
 */
function clubIdOf(c: Parameters<Parameters<typeof createMiddleware<AuthEnv>>[0]>[0], body: unknown): string | null {
  const fromPath = c.req.param('clubId');
  if (typeof fromPath === 'string' && fromPath !== '') return fromPath;
  const fromQuery = c.req.query('club_id');
  if (typeof fromQuery === 'string' && fromQuery !== '') return fromQuery;
  if (body !== null && typeof body === 'object') {
    const v = (body as Record<string, unknown>)['club_id'];
    if (typeof v === 'string' && v !== '') return v;
  }
  return null;
}

/**
 * Betroffene Mitglieder, "soweit guenstig ermittelbar" — Pfad- und
 * Body-Parameter. Bei Listen-Routen bleibt das leer; dort sind Route + Verein
 * die Aussage (der Roster IST die Liste, eine Kopie aller IDs ins Protokoll
 * waere eine zweite Kopie derselben Personendaten und liefe der
 * Datensparsamkeit zuwider).
 */
function memberIdsOf(c: Parameters<Parameters<typeof createMiddleware<AuthEnv>>[0]>[0], body: unknown): string[] {
  const ids = new Set<string>();
  const fromPath = c.req.param('memberId');
  if (typeof fromPath === 'string' && fromPath !== '') ids.add(fromPath);
  if (body !== null && typeof body === 'object') {
    const v = (body as Record<string, unknown>)['member_id'];
    if (typeof v === 'string' && v !== '') ids.add(v);
  }
  return [...ids];
}

/** Das Routen-MUSTER (/clubs/{clubId}/members), nie die konkrete URL. */
function routePatternOf(c: Parameters<Parameters<typeof createMiddleware<AuthEnv>>[0]>[0]): string {
  return c.req.routePath !== '' ? c.req.routePath : c.req.path;
}

export interface OperatorAuditRow {
  actorProfileId: string;
  clubId: string | null;
  route: string;
  method: string;
  access: 'read' | 'write';
  memberIds: string[];
  status: number;
  requestId: string | null;
  ip: string | null;
}

/**
 * Schreibt die Protokollzeile im SERVICE-MODUS.
 *
 * Warum Service-Modus und nicht impersoniert: app.operator_audit_log hat fuer
 * `authenticated` bewusst KEINE insert-Policy (0051). Der Betreiber soll sich
 * keine Zeile erfinden koennen — auch nicht ueber eine Route, die es heute noch
 * nicht gibt. Das Protokoll schreibt das System, nicht der Protokollierte.
 */
export async function writeAuditRow(row: OperatorAuditRow): Promise<void> {
  await withServiceRole('operator audit log (Art. 28 Abs. 3 lit. h DSGVO)', async (tx) => {
    await tx`
      insert into app.operator_audit_log
        (actor_profile_id, club_id, route, method, access, member_ids, status, request_id, ip)
      values
        (${row.actorProfileId}, ${row.clubId}, ${row.route}, ${row.method}, ${row.access},
         ${row.memberIds as unknown as string}, ${row.status}, ${row.requestId}, ${row.ip})`;

    // Die Loeschfrist setzt sich selbst durch (0051: kein pg_cron im Stack).
    auditWrites += 1;
    if (auditWrites % PURGE_EVERY === 0) {
      await tx`select app.purge_operator_audit_log()`;
    }
  });
}

/**
 * DER Bypass-Punkt. Fuer alle anderen ein reiner Durchreicher.
 *
 * ### Die Gegenprobe steckt in der ersten Zeile ###
 * Wer keinen signierten Plattform-Admin-Claim traegt, laeuft in `return next()`
 * — keine Markierung, kein Protokoll, keine zusaetzliche Abfrage, kein
 * veraendertes Verhalten. Fuer ein Mitglied oder einen Trainer aendert sich
 * durch diese Middleware buchstaeblich nichts.
 */
export const operatorAccess = createMiddleware<AuthEnv>(async (c, next) => {
  const claims: AuthClaims | undefined = c.get('claims');
  if (claims === undefined || !isPlatformAdmin(claims)) {
    return next();
  }

  // Der Body wird fuer die Zuordnung gebraucht (POST /routines traegt club_id
  // nur dort). c.req.json() cached in Hono, der Handler liest ihn danach
  // normal weiter.
  let body: unknown = null;
  if (!SAFE_METHODS.has(c.req.method)) {
    body = await c.req.json().catch(() => null);
  }

  // AB HIER ist die Betreiber-Einsicht eingeschaltet: db.ts setzt daraufhin
  // app.operator_override in jeder Transaktion dieses Requests, und die Gates
  // in guards.ts/capabilities.ts lassen durch. Der Weg hierher fuehrt
  // ausschliesslich durch diese Funktion — und die schreibt unten das Protokoll.
  markOperatorAccess(claims);

  await next();

  const row: OperatorAuditRow = {
    actorProfileId: claims.sub,
    clubId: clubIdOf(c, body),
    route: routePatternOf(c),
    method: c.req.method,
    access: SAFE_METHODS.has(c.req.method) ? 'read' : 'write',
    memberIds: memberIdsOf(c, body),
    status: c.res.status,
    requestId: c.get('requestId') ?? null,
    ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  };

  try {
    await writeAuditRow(row);
  } catch (err) {
    // Fail-closed: lieber keine Antwort als eine unprotokollierte. Die Daten
    // sind zwar gelesen, verlassen den Prozess aber nicht.
    console.error(
      `[operator-access] AUDIT-SCHREIB FEHLGESCHLAGEN — Antwort verworfen. ` +
        `actor=${row.actorProfileId} club=${row.clubId ?? '-'} route=${row.method} ${row.route}`,
      err,
    );
    c.res = new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        detail:
          'Betreiber-Zugriff ist nur mit Protokoll zulaessig; das Protokoll konnte nicht geschrieben werden. ' +
          '/ Operator access is only permitted with an audit trail; the audit entry could not be written.',
      }),
      { status: 503, headers: { 'content-type': 'application/problem+json' } },
    );
  }
});
