// ============================================================================
// lib/security-log.ts - auswertbares Protokoll fuer abgewiesene Versuche.
//
// WARUM ES DAS BRAUCHT:
// middleware/error.ts loggte bis 0034 erst ab Status >= 500. Ein Brute-Force
// auf Einladungscodes erzeugt nur 401/404/429 und hinterliess damit KEINE
// Zeile. error.ts schreibt jetzt eine Konsolenzeile - fuer die Auswertung
// ("wie viele Codes wurden in der letzten Stunde durchprobiert, von wo?")
// reicht das nicht: Konsolenlogs sind nicht abfragbar.
//
// WAS HIER *NICHT* HINEINGEHOERT:
//   * Der versuchte CODE. Sonst waere das Protokoll selbst eine Code-Liste -
//     wer es liest, haette die Sammlung, die er sich erst erarbeiten wollte.
//   * Tokens, Kennwoerter, Kopfzeilen.
//
// LOESCHFRIST: internal.auth_events.expires_at (14 Tage, Vorgabe aus 0034) +
// internal.purge_auth_events(). Die Tabelle sammelt IP-Adressen, also
// personenbezogene Daten - eine unbegrenzte Sammlung waere ab dem ersten Tag
// ein Verstoss gegen Art. 5 Abs. 1 lit. e DSGVO.
// ============================================================================

import type { Context } from 'hono';
import { withServiceRole } from '../db.js';
import type { AuthEnv } from '../middleware/auth.js';
import { clientIp } from './rate-limit.js';

export type AuthEventName =
  | 'join_code_invalid'
  | 'join_code_expired'
  | 'join_code_revoked'
  | 'join_rate_limited'
  | 'join_already_member'
  | 'club_create_rate_limited'
  | 'approve_forbidden';

export interface AuthEventInput {
  event: AuthEventName;
  status: number;
  /** Kontext OHNE Geheimnisse. Nie der versuchte Code. */
  detail?: Record<string, unknown>;
}

/**
 * Schreibt eine Protokollzeile. Bewusst "fire and forget": ein Protokollfehler
 * darf die Antwort an den Aufrufer nie veraendern - sonst waere eine volle
 * Platte eine Authentifizierungsluecke (oder umgekehrt ein Weg, aus dem
 * Antwortverhalten auf den Protokollzustand zu schliessen).
 */
export function recordAuthEvent(c: Context<AuthEnv>, input: AuthEventInput): void {
  const ip = clientIp(c) ?? null;
  const route = c.req.path;
  const profileId = safeSub(c);
  const detail = JSON.stringify(input.detail ?? {});

  void withServiceRole('security log (internal.auth_events)', (tx) =>
    tx`insert into internal.auth_events (event, status, route, ip, profile_id, detail)
       values (${input.event}, ${input.status}, ${route}, ${ip}::inet, ${profileId}::uuid, ${detail}::jsonb)`,
  ).catch((err: unknown) => {
    console.error(`[security-log] konnte ${input.event} nicht protokollieren:`, err);
  });
}

/** claims kann fehlen (oeffentliche/abgewiesene Anfragen) - dann kein Bezug. */
function safeSub(c: Context<AuthEnv>): string | null {
  try {
    return c.get('claims')?.sub ?? null;
  } catch {
    return null;
  }
}
