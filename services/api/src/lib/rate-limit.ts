// ============================================================================
// lib/rate-limit.ts - Drosselung auf drei Achsen (Migration 0034).
//
// WARUM NICHT IM PROZESS:
// Ein Map<string, number> im Node-Prozess ist nach jedem Deploy wieder leer und
// zaehlt pro Container. Beides macht ihn als Schutz wertlos, sobald es mehr als
// einen Prozess gibt oder jemand neu startet. Der Zaehler liegt deshalb in
// Postgres (internal.auth_rate_limits, service_role-only).
//
// DIE DREI ACHSEN - und warum die dritte die wichtige ist:
//
//   ip       Ein Anschluss. Haelt den Gelegenheitsversuch auf. Ein Botnetz mit
//            1000 Adressen umgeht sie vollstaendig.
//   account  Ein Konto. Haelt auf, wer mit EINEM Konto durchprobiert. Wer
//            Konten anlegen kann, umgeht sie.
//   code     EIN Einladungscode. Siehe die Richtigstellung unten - diese Achse
//            kann deutlich WENIGER, als hier bis 0038 behauptet wurde.
//
// ----------------------------------------------------------------------------
// RICHTIGSTELLUNG (0038) - DER ALTE KOPF DIESER DATEI WAR FALSCH
// ----------------------------------------------------------------------------
// Hier stand: "code ... begrenzt, wie oft ein Code UEBERHAUPT geraten werden
// darf, egal von wem und von wo. Sie ist die einzige, die gegen verteilte Bots
// wirkt." und "Bei 40 Bit Coderaum und 20 Rateversuchen pro Code und Stunde
// braucht ein Angreifer ~3 Millionen Jahre pro Code."
//
// Beides stimmt nicht, und zwar aus einem einzigen Grund: der Zaehler haengt am
// VERSUCHTEN Code, nicht am angegriffenen Verein. Wer raet, tippt jedes Mal
// einen ANDEREN Code - denselben falschen Code zweimal zu probieren ist sinnlos.
// Jeder Rateversuch trifft also einen frischen Zaehler (1 von 20). Nachgemessen
// am Bestand vor 0038:
//     500 Versuche mit 500 VERSCHIEDENEN Codes -> gesperrt:  0 von 500
//      25 Versuche mit DEMSELBEN       Code    -> gesperrt:  5 von  25
// Die Achse bremst genau einen Fall: dass jemand DENSELBEN Code oft schickt.
// Das ist nie der Angreifer, sondern der Verein, der 30 Kinder anmeldet.
//
// WAS DEN CODE WIRKLICH SCHUETZT: die 40 Bit aus dem CSPRNG
// (app.generate_join_code, 0034). Ein verteiltes Botnetz ist nur ueber die
// account-Achse begrenzt; bei 10.000 Vereinen trifft ein Rateversuch mit
// ~1e4/2^40 ~ 9e-9, fuer 50 % Trefferchance braucht es ~7,6e9 Konto-Stunden.
// Das ist die Verteidigung - und sie steht ohne die code-Achse.
//
// 0038 zieht die Folgerung: auf der code-Achse zaehlen nur noch RATEVERSUCHE
// (Codes, die auf keinen lebenden Verein zeigen). Dauerfeuer auf EINEN FALSCHEN
// Code bleibt gesperrt - Verteidigung in der Tiefe, unveraendert scharf.
// ============================================================================

import { createHmac } from 'node:crypto';
import type { Context } from 'hono';
import { withServiceRole } from '../db.js';
import { getConfig } from '../config.js';
import { problem } from '../middleware/error.js';
import type { AuthEnv } from '../middleware/auth.js';

export type RateLimitScope = 'ip' | 'account' | 'code';

// ============================================================================
// DIE LOESCHFRIST BRAUCHT EINEN AUSLOESER - SONST IST SIE NUR EINE SPALTE
// ============================================================================
//
// 0034 setzt die 14-Tage-Frist (Art. 5 Abs. 1 lit. e DSGVO) mit
// 'if random() < 0.01' aus internal.rate_limit_hit heraus durch. Das hatte zwei
// Fehler, und 0038 nimmt es deshalb dort ganz heraus:
//   a) ES SASS IM ROW-LOCK. Gemessen: 43 ms Purge (200.000 Zeilen) bei
//      gehaltenem code-Lock; eine zweite Sitzung mit DEMSELBEN Code lief in den
//      Lock-Timeout, mit einem anderen Code brauchte sie 3,4 ms. Und je haerter
//      der Angriff, desto groesser das Protokoll, desto laenger der Lock: der
//      Schutz drosselte unter Last sich selbst.
//   b) ES HING AN DER LAST. Ein Verein mit 5 Beitritten im Monat loest 1 % im
//      Mittel alle 20 MONATE aus. Die Frist war genau dort gebrochen, wo sie am
//      leichtesten einzuhalten waere.
//
// Ausloeser jetzt: die API. internal.maybe_purge_auth_events ist
// zeitgesteuert (hoechstens einmal pro Stunde) und nimmt den Zuschlag mit
// 'for update skip locked' - bei mehreren Instanzen raeumt genau eine, und
// keine Anfrage wartet darauf.
//
// ZWEI AUSLOESER, weil einer beide Luecken nicht schliesst:
//   * bei JEDEM Drossel-Aufruf (unten): deckt den laufenden Betrieb ab, kostet
//     dank Zeitsteuerung fast immer nur ein 'not found'.
//   * ein Zeitgeber, faul gestartet: deckt den Fall ab, dass der Verkehr
//     VERSIEGT. Ohne ihn blieben die letzten Zeilen bis zum naechsten Beitritt
//     liegen - bei einem Verein in der Sommerpause Monate.
// Beides FEUERT UND VERGISST: eine Wartung darf eine Antwort nie verzoegern und
// erst recht nie scheitern lassen.
//
// unref(): der Zeitgeber haelt den Node-Prozess nicht am Leben (sonst haengen
// Tests und ein 'docker stop' am Ende).
// ============================================================================

const MAINTENANCE_EVERY_MS = 60 * 60 * 1000;
let maintenanceTimer: ReturnType<typeof setInterval> | undefined;
let lastMaintenanceAttempt = 0;

function runMaintenance(): void {
  void withServiceRole('auth-event retention (internal.maybe_purge_auth_events)', (tx) =>
    tx`select internal.maybe_purge_auth_events(${'1 hour'}::interval) as deleted`,
  ).catch((err: unknown) => {
    console.error('[rate-limit] Loeschfrist konnte nicht durchgesetzt werden:', err);
  });
}

/**
 * Startet den Wartungs-Zeitgeber beim ersten Drossel-Aufruf und stoesst die
 * Wartung an. Bewusst faul: so braucht es KEINE Zeile in index.ts/app.ts, und
 * es gibt keinen Weg, die Drossel zu benutzen und die Frist dabei zu vergessen.
 */
function scheduleMaintenance(): void {
  if (maintenanceTimer === undefined) {
    maintenanceTimer = setInterval(runMaintenance, MAINTENANCE_EVERY_MS);
    maintenanceTimer.unref();
  }

  // DIE SPERRE HIER IST NICHT KOSMETIK, SIE IST TEIL VON F1.
  // Ohne sie schickte JEDER Drossel-Aufruf eine zusaetzliche Abfrage los und
  // belegte dafuer eine zweite Pool-Verbindung — auf demselben Pfad, den F1
  // gerade entlasten soll. Der Beitritts-Pfad haette damit doppelt so viele
  // Verbindungen gebraucht wie vorher: eine Wartung, die den Selbst-DoS
  // schlimmer macht, waere die Wartung nicht wert.
  // Die Datenbank wuerde zwar ohnehin 'nicht faellig' antworten (skip locked +
  // Zeitsteuerung), aber die Verbindung waere da schon belegt. Also gar nicht
  // erst hinfahren.
  const now = Date.now();
  if (now - lastMaintenanceAttempt < MAINTENANCE_EVERY_MS) return;
  lastMaintenanceAttempt = now;
  runMaintenance();
}

/** Nur fuer Tests: Zeitgeber abraeumen und die Sperre zuruecksetzen. */
export function stopAuthMaintenanceForTests(): void {
  if (maintenanceTimer !== undefined) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = undefined;
  }
  lastMaintenanceAttempt = 0;
}

export interface RateLimitRule {
  scope: RateLimitScope;
  /** Wert der Achse. Bei scope='code' MUSS der normalisierte Code rein. */
  identifier: string | undefined;
  /** Erlaubte Versuche pro Fenster. */
  limit: number;
  /** Fensterlaenge als Postgres-Intervall, z.B. '1 hour'. */
  window: string;
}

export interface RateLimitVerdict {
  allowed: boolean;
  retryAfter: number;
  scope: RateLimitScope;
}

/**
 * Client-IP. Hinter dem Reverse-Proxy steht die echte Adresse in
 * x-forwarded-for (erster Eintrag); direkt ist es die Socket-Adresse.
 *
 * ACHTUNG, bewusste Grenze: x-forwarded-for ist FAELSCHBAR, solange nicht ein
 * vertrauenswuerdiger Proxy den Header ueberschreibt. Die IP-Achse ist deshalb
 * nur so gut wie das Deployment - genau deshalb haengt der Schutz hier NICHT an
 * ihr, sondern an der code-Achse, die niemand faelschen kann.
 */
export function clientIp(c: Context): string | undefined {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd !== undefined && fwd.trim() !== '') {
    const first = fwd.split(',')[0]?.trim();
    if (first !== undefined && first !== '') return first;
  }
  const real = c.req.header('x-real-ip');
  if (real !== undefined && real.trim() !== '') return real.trim();
  return undefined;
}

/**
 * Pseudonymisierung des GESPEICHERTEN Merkmals (Art. 32 Abs. 1 lit. a DSGVO).
 *
 * WARUM UEBERHAUPT: internal.auth_rate_limits.identifier hielt bis 0038 auf der
 * ip-Achse die IP und auf der code-Achse den Vereinscode IM KLARTEXT. Das zweite
 * ist der schwerere Fehler: 0034 sagt fuer das Protokoll ausdruecklich "Der
 * versuchte Code wird NIE gespeichert - sonst waere das Protokoll selbst eine
 * Code-Liste", speichert ihn im Drossel-Zaehler aber sehr wohl - und dank der
 * ERFOLGREICHEN Beitritte sind das die ECHTEN Codes lebender Vereine. Wer die
 * Tabelle lesen kann, haette genau die Sammlung, die 0034 ihm verwehren wollte.
 *
 * WARUM EIN HASH REICHT: eine Drossel braucht nie den Wert, nur GLEICHHEIT.
 * hmac(pfeffer, wert) leistet das identisch.
 *
 * WARUM MIT PFEFFER UND WARUM IN NODE: ohne Pfeffer waeren 2^32 IPv4-Adressen
 * in Sekunden durchprobiert - ein blosser sha256(ip) waere Theater. Der Pfeffer
 * liegt in der API-Umgebung und NIE in der Datenbank; ein Datenbankabzug allein
 * laesst sich damit nicht zurueckrechnen. Genau deshalb wird hier in Node
 * gehasht und nicht in Postgres (pgcrypto ist in diesem Stack ohnehin nirgends
 * installiert, hmac() gaebe es dort also gar nicht).
 *
 * NICHT gehasht: 'account'. Das ist die profile_id - ein Schluessel, der in
 * dieser Datenbank ohnehin ueberall steht; ein Hash davon waere Aufwand ohne
 * Gewinn.
 */
function storedIdentifier(scope: RateLimitScope, value: string): string {
  if (scope === 'account') return value;
  return createHmac('sha256', getConfig().rateLimit.ipPepper).update(value).digest('base64url');
}

/**
 * Zaehlt EINEN Versuch auf jeder Achse und liefert das erste Veto.
 *
 * Zaehlt bewusst auf ALLEN Achsen, auch wenn eine fruehere schon gesperrt hat:
 * sonst koennte ein Angreifer die code-Achse verstecken, indem er die
 * ip-Achse absichtlich ueberlaeuft.
 *
 * EIN RUNDLAUF, NICHT DREI (0038). Vorher lief pro Achse eine eigene Abfrage in
 * derselben Transaktion. Das war aus zwei Gruenden schlecht:
 *   * Der Row-Lock auf der code-Zeile wurde bis zum Commit gehalten. Dass er
 *     trotzdem kurz blieb, hing EINZIG daran, dass 'code' in registration.ts
 *     zufaellig zuletzt in der Liste steht. Sortiert das jemand um, wird der
 *     Lock ueber zwei weitere Rundlaeufe gehalten - und kein Test merkt es.
 *   * Drei Rundlaeufe halten die Pool-Verbindung dreimal so lange. Der Pool ist
 *     fuer die GESAMTE API geteilt (db.ts, F1).
 * internal.rate_limit_hit_many macht es in einem Aufruf und in fester
 * Reihenfolge -> gleiche Lock-Reihenfolge fuer alle Aufrufer -> per Konstruktion
 * kein Deadlock.
 */
export async function checkRateLimits(rules: readonly RateLimitRule[]): Promise<RateLimitVerdict> {
  const active = rules.filter(
    (r): r is RateLimitRule & { identifier: string } =>
      r.identifier !== undefined && r.identifier !== '',
  );
  if (active.length === 0) return { allowed: true, retryAfter: 0, scope: 'ip' };

  const verdicts = await withServiceRole('rate-limit check (internal.auth_rate_limits)', async (tx) => {
    const rows = await tx<{ scope: RateLimitScope; allowed: boolean; retry_after: number }[]>`
      select scope, allowed, retry_after
      from internal.rate_limit_hit_many(
        ${active.map((r) => r.scope)}::text[],
        ${active.map((r) => storedIdentifier(r.scope, r.identifier))}::text[],
        ${active.map((r) => r.limit)}::integer[],
        ${active.map((r) => r.window)}::interval[],
        -- p_probe: der KLARTEXT, ausschliesslich fuer die Frage "ist das ein
        -- Rateversuch?" (0038). Reiner Bind-Parameter - er wird gelesen und
        -- NIE gespeichert; gespeichert wird nur der Hash oben.
        ${active.map((r) => (r.scope === 'code' ? r.identifier : null))}::text[]
      )`;
    return rows.map((row) => ({
      allowed: row.allowed,
      retryAfter: row.retry_after,
      scope: row.scope,
    }));
  });

  // Die Wartung haengt am Verkehr, nicht am Zufall - siehe scheduleMaintenance.
  scheduleMaintenance();

  const blocked = verdicts.filter((v) => !v.allowed);
  if (blocked.length === 0) return { allowed: true, retryAfter: 0, scope: 'ip' };

  // Laengste Wartezeit gewinnt - sonst verriete ein kurzes Retry-After, welche
  // Achse zuerst zuschlug.
  blocked.sort((a, b) => b.retryAfter - a.retryAfter);
  return blocked[0] as RateLimitVerdict;
}

/**
 * Wie checkRateLimits, wirft aber direkt den 429 (RFC 7807 + Retry-After).
 */
export async function enforceRateLimits(
  c: Context<AuthEnv>,
  rules: readonly RateLimitRule[],
): Promise<void> {
  const verdict = await checkRateLimits(rules);
  if (verdict.allowed) return;

  // Die Achse selbst wird NICHT verraten. "Zu viele Versuche fuer diesen Code"
  // waere schon eine Auskunft: es bestaetigte, dass es den Code gibt.
  throw problem(
    429,
    'Too Many Requests',
    `Zu viele Versuche. Bitte in ${verdict.retryAfter} Sekunden erneut versuchen. ` +
      `/ Too many attempts. Please retry in ${verdict.retryAfter} seconds.`,
  ).withHeaders({ 'retry-after': String(verdict.retryAfter) });
}
