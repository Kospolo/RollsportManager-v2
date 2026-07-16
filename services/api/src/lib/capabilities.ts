// ============================================================================
// lib/capabilities.ts - RBAC-Aufloesung fuer die API (RBAC-DESIGN §5/§6).
//
// ### Warum es diese Datei gibt ###
// guards.ts beantwortet "welche Rolle steht im TOKEN?". Das hat zwei Loecher,
// die Phase 1 in der Datenbank laengst geschlossen hat (Migration 0025):
//   * MEHRFACHROLLEN wirken nicht - der Claim traegt genau EINE Rolle je
//     Verein, die Datenbank kennt beliebig viele (Rechte = Vereinigung).
//   * Der Claim ist bis zu einer Token-Lebensdauer VERALTET - die DB loest
//     seit 0025 live auf ("Aenderungen wirken sofort, ohne Re-Login").
// Diese Datei zieht die API auf denselben Stand: sie fragt die DB, nicht den
// Claim.
//
// ### Die eine Regel: NICHT selbst rechnen ###
// Die Versuchung waere, role_permissions zu lesen und das Maximum in TS zu
// bilden. Das waere ein ZWEITES Regelwerk neben app.cap_rank - und es liefe
// beim naechsten Regelwechsel auseinander (owner-Kurzschluss bei protected,
// Mitgliedschafts-Gate deleted_at/status/valid_until, Mehrfachrollen-Union).
// Deshalb ruft loadCaps ausschliesslich app.cap_ranks (0029) auf, das seinerseits
// an app.cap_rank delegiert. Die API kodiert von der Skala nur EINES: die
// Reihenfolge - und die ist per Test an die DB genagelt (siehe CAPABILITY_LEVELS).
//
// ### Verhaeltnis zu RLS ###
// Kein Ersatz, sondern die erste Linie. Alles laeuft weiter durch withUser
// (src/db.ts) -> RLS + Trigger bleiben die zweite Verteidigungslinie. Wo ein
// Guard hier faelschlich durchlaesst, faengt die Policy es ab (42501 -> 403).
// ============================================================================

import type { Context } from 'hono';
import type { Tx } from '../db.js';
import { withUser } from '../db.js';
import type { AuthEnv } from '../middleware/auth.js';
import { problem } from '../middleware/error.js';

/**
 * Die Stufen-Skala (RBAC-DESIGN §2), in der Reihenfolge des DB-Enums
 * app.role_level. Der Index IST der Rang - identisch zu app.level_rank
 * (0022:37-52): none=0 · read_own=1 · read_team=2 · read_all=3 · edit=4 · manage=5.
 *
 * Das ist die EINZIGE Stelle, an der die API die Skala numerisch kodiert. Sie
 * ist unvermeidbar, weil der Contract-Enum CapabilityLevel ohnehin in TS
 * existieren muss. Abgesichert ist sie doppelt:
 *   * services/api/scripts/smoke.mjs prueft app.level_rank je Enumwert gegen
 *     CAPABILITY_LEVELS.indexOf (DB-gestuetzt, echte Werte)
 *   * supabase/tests/sql/93e_rbac_resolution.sql prueft die Umkehrbarkeit
 *     level_of_rank(level_rank(l)) = l ueber enum_range
 * Waechst das DB-Enum, fallen beide.
 */
export const CAPABILITY_LEVELS = [
  'none',
  'read_own',
  'read_team',
  'read_all',
  'edit',
  'manage',
] as const;

export type CapabilityLevel = (typeof CAPABILITY_LEVELS)[number];

/** Rang einer Stufe (0..5) - das TS-Gegenstueck zu app.level_rank. */
export function rankOf(level: CapabilityLevel): number {
  return CAPABILITY_LEVELS.indexOf(level);
}

/** Stufe zu einem Rang - das Gegenstueck zu app.level_of_rank (0029). */
export function levelOfRank(rank: number): CapabilityLevel | undefined {
  return CAPABILITY_LEVELS[rank];
}

/** Eine aufgeloeste Faehigkeit, so wie sie GET /me/capabilities ausliefert. */
export interface ResolvedCap {
  capability_key: string;
  label_de: string;
  label_en: string;
  allowed_levels: CapabilityLevel[];
  sort: number;
  rank: number;
  level: CapabilityLevel;
}

/** Die aufgeloesten Rechte einer Person in EINEM Verein. */
export interface ClubCaps {
  /** Rollen-Keys aus der DB (nicht aus dem Claim!) - leer = keine Mitgliedschaft. */
  roleKeys: string[];
  /** capability_key -> Rang (0..5). Fehlt ein Key, ist der Rang 0 (fail-closed). */
  ranks: Map<string, number>;
  /** Der volle Katalog inkl. Labels - fuer GET /me/capabilities. */
  caps: ResolvedCap[];
}

/**
 * Laedt die aufgeloesten Rechte innerhalb einer bestehenden Transaktion.
 * app.cap_ranks + app.member_role_keys - beides DB-aufgeloest, beides inklusive
 * Mitgliedschafts-Gate.
 */
export async function loadCaps(tx: Tx, clubId: string): Promise<ClubCaps> {
  const rows = await tx`
    select capability_key, label_de, label_en, allowed_levels, sort, rank, level
    from app.cap_ranks(${clubId})`;
  const roleRows = await tx`select app.member_role_keys(${clubId}) as keys`;

  const caps: ResolvedCap[] = rows.map((r) => ({
    capability_key: r['capability_key'] as string,
    label_de: r['label_de'] as string,
    label_en: r['label_en'] as string,
    allowed_levels: r['allowed_levels'] as CapabilityLevel[],
    sort: r['sort'] as number,
    rank: r['rank'] as number,
    level: r['level'] as CapabilityLevel,
  }));

  return {
    roleKeys: (roleRows[0]?.['keys'] as string[] | null) ?? [],
    ranks: new Map(caps.map((c) => [c.capability_key, c.rank])),
    caps,
  };
}

// ---------------------------------------------------------------------------
// Memoisierung je (Request, Verein).
//
// Ohne sie kostete jeder Guard eine eigene Transaktion; eine Route, die zwei
// Faehigkeiten prueft, zahlte doppelt. Der Cache haengt am Context-Objekt und
// stirbt mit dem Request - eine WeakMap, damit nichts geleakt wird und
// insbesondere NICHTS ueber Requests hinweg ueberlebt (ein prozessweiter Cache
// waere genau der Fehler, den 0025 in der DB gerade behoben hat: veraltete
// Rechte). Innerhalb EINES Requests ist der Snapshot bewusst stabil.
// ---------------------------------------------------------------------------
const capsCache = new WeakMap<object, Map<string, Promise<ClubCaps>>>();

/** Die aufgeloesten Rechte der aufrufenden Person - eine Transaktion je (Request, Verein). */
export function capsFor(c: Context<AuthEnv>, clubId: string): Promise<ClubCaps> {
  let perClub = capsCache.get(c);
  if (!perClub) {
    perClub = new Map();
    capsCache.set(c, perClub);
  }
  let entry = perClub.get(clubId);
  if (!entry) {
    const claims = c.get('claims');
    entry = withUser(claims, (tx) => loadCaps(tx, clubId));
    perClub.set(clubId, entry);
  }
  return entry;
}

/** Der aufgeloeste Rang einer Faehigkeit (0..5). Fuer read_own-Zweige. */
export async function capRankOf(
  c: Context<AuthEnv>,
  clubId: string,
  capability: string,
): Promise<number> {
  const caps = await capsFor(c, clubId);
  return caps.ranks.get(capability) ?? 0;
}

/**
 * Wirft 403, wenn die aufrufende Person die Mindeststufe nicht erreicht.
 * Das API-Gegenstueck zu app.has_cap(club_id, capability, min_level).
 *
 * Fehlermeldung bilingual: die Clients zeigen `detail` bei unerwarteten
 * Fehlern direkt an, und das Projekt liefert Nutzertexte grundsaetzlich DE+EN.
 */
export async function requireCap(
  c: Context<AuthEnv>,
  clubId: string,
  capability: string,
  minLevel: CapabilityLevel,
): Promise<void> {
  const rank = await capRankOf(c, clubId, capability);
  if (rank < rankOf(minLevel)) {
    throw problem(
      403,
      'Forbidden',
      `Fehlende Berechtigung: "${capability}" mindestens Stufe "${minLevel}" erforderlich. ` +
        `/ Missing permission: "${capability}" requires at least level "${minLevel}".`,
    );
  }
}

/**
 * Ist die aufrufende Person laut DATENBANK Mitglied? (Nicht laut Claim.)
 * Unterschied zu guards.requireClubMember: dort kann der Claim Mitgliedschaft
 * nur UEBERbehaupten (dann filtert RLS auf 0 Zeilen) - hier zaehlt der
 * Mitgliedschafts-Gate aus 0025 (deleted_at/status/valid_until).
 */
export async function isClubMemberInDb(c: Context<AuthEnv>, clubId: string): Promise<boolean> {
  const caps = await capsFor(c, clubId);
  return caps.roleKeys.length > 0;
}

/**
 * DB-aufgeloestes Gegenstueck zu guards.requireClubRole - dieselbe Rollenmenge,
 * aber aus app.member_roles statt aus dem Token.
 *
 * ### Wann DIESES statt requireCap? ###
 * Nur dort, wo es zur Rollenmenge KEINE passende Faehigkeit gibt. Konkret:
 * /reports/summary gated auf COACH_ROLES, aber der Katalog kennt keine
 * Faehigkeit "Auswertung" (RBAC-DESIGN §3 fuehrt sie nicht). Eine Faehigkeit zu
 * erfinden waere eine Katalog-Erweiterung mit eigener Entscheidung - und eine
 * beliebige andere zu nehmen, die zufaellig dieselbe Rollenmenge trifft
 * (attendance:edit trifft COACH_ROLES), waere eine stille Bedeutungsverschiebung:
 * wer spaeter attendance umkonfiguriert, veraenderte unbeabsichtigt den Zugang
 * zur Auswertung.
 *
 * Der Gewinn bleibt derselbe wie bei requireCap: MEHRFACHROLLEN wirken, und der
 * Mitgliedschafts-Gate aus 0025 (deleted_at/status/valid_until) greift - beides
 * kann der Claim nicht. Die Rollenmenge ist unveraendert -> keine Rechteaenderung.
 */
export async function requireClubRoleDb(
  c: Context<AuthEnv>,
  clubId: string,
  roles: readonly string[],
): Promise<void> {
  const caps = await capsFor(c, clubId);
  if (!caps.roleKeys.some((k) => roles.includes(k))) {
    throw problem(
      403,
      'Forbidden',
      `Erfordert eine dieser Rollen: ${roles.join(', ')}. / Requires one of: ${roles.join(', ')}.`,
    );
  }
}
