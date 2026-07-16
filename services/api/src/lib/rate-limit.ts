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
//   code     EIN Einladungscode, global ueber ALLE Aufrufer hinweg. Diese Achse
//            kann weder ein Proxy noch ein CAPTCHA liefern: sie begrenzt, wie
//            oft ein Code UEBERHAUPT geraten werden darf, egal von wem und von
//            wo. Sie ist die einzige, die gegen verteilte Bots wirkt.
//
// Bei 40 Bit Coderaum (0034) und 20 Rateversuchen pro Code und Stunde braucht
// ein Angreifer im Erwartungswert ~3 Millionen Jahre pro Code.
// ============================================================================

import type { Context } from 'hono';
import { withServiceRole } from '../db.js';
import { problem } from '../middleware/error.js';
import type { AuthEnv } from '../middleware/auth.js';

export type RateLimitScope = 'ip' | 'account' | 'code';

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
 * Zaehlt EINEN Versuch auf jeder Achse und liefert das erste Veto.
 *
 * Zaehlt bewusst auf ALLEN Achsen, auch wenn eine fruehere schon gesperrt hat:
 * sonst koennte ein Angreifer die code-Achse verstecken, indem er die
 * ip-Achse absichtlich ueberlaeuft.
 */
export async function checkRateLimits(rules: readonly RateLimitRule[]): Promise<RateLimitVerdict> {
  const verdicts = await withServiceRole('rate-limit check (internal.auth_rate_limits)', async (tx) => {
    const out: RateLimitVerdict[] = [];
    for (const rule of rules) {
      if (rule.identifier === undefined || rule.identifier === '') continue;
      const rows = await tx<{ allowed: boolean; retry_after: number }[]>`
        select allowed, retry_after
        from internal.rate_limit_hit(
          ${rule.scope}, ${rule.identifier}, ${rule.limit}, ${rule.window}::interval
        )`;
      const row = rows[0];
      if (row === undefined) continue;
      out.push({ allowed: row.allowed, retryAfter: row.retry_after, scope: rule.scope });
    }
    return out;
  });

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
