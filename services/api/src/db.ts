// ============================================================================
// db.ts - postgres.js pool + per-request RLS impersonation.
//
// DESIGN (Blueprint ADR-E2/E3, risk #16):
// The API is NOT a RLS bypass. For every request that acts on behalf of a
// user we open a transaction and
//     1. SET LOCAL request.jwt.claims = '<claims json>'   (what GoTrue/
//        PostgREST would set - app.jwt_claims()/auth.uid() read it)
//     2. SET LOCAL ROLE authenticated
// so ALL row-level-security policies and the protective triggers
// (protect_club_membership, ledger immutability, ...) apply to API-issued
// statements exactly as they would to a direct PostgREST request.
// "Impersonation instead of bypass" - RLS stays the second line of defense.
//
// A separate SERVICE MODE (withServiceRole) exists ONLY for explicitly marked
// system operations (e.g. app.next_invoice_number(), entitlement writes from
// the webhook service). service_role has BYPASSRLS and no `sub`, so the
// self-protection triggers do not fire there - every service-mode call site
// MUST authorize on its own and state a reason (logged).
//
// Connection role: the API connects as a dedicated role that is a member of
// both `authenticated` and `service_role` (local harness: the postgres
// superuser). SET LOCAL ROLE resets automatically at transaction end.
// ============================================================================

import postgres from 'postgres';
import type { Sql, TransactionSql } from 'postgres';
import { getConfig } from './config.js';
import type { AuthClaims } from './middleware/auth.js';

let pool: Sql | undefined;

export function getPool(): Sql {
  const cfg = getConfig();
  pool ??= postgres(cfg.databaseUrl, {
    // ------------------------------------------------------------------
    // POOL-GROESSE — und warum die Zahl NICHT der Schutz ist.
    //
    // Bis 0038 stand hier fest 'max: 10' fuer die GESAMTE API. Der Einwand
    // dagegen stimmt: der Pool ist geteilt, also nimmt jede Anfrage auf dem
    // Beitritts-Pfad eine Verbindung, die dann JEDER anderen Route fehlt —
    // Kasse, Trainingsplan, alles. Zehn gleichzeitige Angreifer koennen den
    // Pool halten, und die Drossel verteidigt sich ausgerechnet dadurch, dass
    // die Flut in die Datenbank SCHREIBT.
    //
    // ABER: die Zahl hochzudrehen ist keine Abwehr. Bei max=20 halten eben
    // zwanzig Angreifer den Pool; man verschiebt die Grenze, man zieht sie
    // nicht. Was wirklich zaehlt, ist die HALTEDAUER pro Anfrage — Durchsatz
    // ist Verbindungen geteilt durch Haltedauer. Genau dort lag der Fehler,
    // und dort ist er behoben:
    //   * 0038 nimmt die Purge aus dem Zaehler-Pfad. Vorher hielt 1 % der
    //     Drossel-Aufrufe die Verbindung UND den Row-Lock 43 ms lang fest
    //     (gemessen, 200.000 Zeilen) — und je haerter der Angriff, desto
    //     groesser das Protokoll, desto laenger die Purge. Das war die
    //     eigentliche Selbst-DoS-Schleife.
    //   * 0038 zaehlt echte Vereinscodes gar nicht mehr -> ehrliche Beitritte
    //     nehmen ueberhaupt keinen Lock.
    //   * lib/rate-limit.ts fragt alle Achsen in EINEM Rundlauf statt in drei.
    // Nach diesen drei Aenderungen liegt eine Drossel-Transaktion im
    // Millisekundenbereich statt potenziell im Sekundenbereich.
    //
    // Die Zahl ist damit ein Kapazitaets-Regler, kein Sicherheitsgrenzwert —
    // und gehoert deshalb in die Konfiguration statt in eine Konstante.
    // Vorgabe 20: Postgres steht per Vorgabe auf max_connections=100, das
    // laesst Platz fuer mehrere API-Instanzen plus Wartung.
    max: cfg.db.poolMax,

    // Warten hat eine Grenze. Ohne connect_timeout stapeln sich Anfragen
    // unbegrenzt, wenn die Datenbank klemmt, und der Node-Prozess kippt am
    // Speicher statt sauber 503 zu sagen.
    connect_timeout: cfg.db.connectTimeoutSeconds,

    connection: {
      // DIE ZWEI HARTEN SCHRANKEN GEGEN "Verbindung fuer immer belegt".
      // Sie wirken serverseitig und damit auch dann, wenn im Node-Prozess
      // etwas haengt oder ein Fehlerpfad ein Commit vergisst.
      //   statement_timeout: keine einzelne Anweisung darf eine Pool-
      //     Verbindung endlos halten (das war der Weg, auf dem eine langsame
      //     Purge unter Last alles mitgerissen haette).
      //   idle_in_transaction_session_timeout: eine offene, aber untaetige
      //     Transaktion haelt sonst nicht nur die Verbindung, sondern auch
      //     jeden Row-Lock darin — genau der Effekt, den 0038 abstellt.
      // Beide sind grosszuegig: was hier anschlaegt, ist ein Fehler.
      // Zahl = Millisekunden (Postgres-Vorgabeeinheit fuer beide GUCs).
      statement_timeout: cfg.db.statementTimeoutMs,
      idle_in_transaction_session_timeout: cfg.db.idleInTransactionTimeoutMs,
      // Damit man in pg_stat_activity sieht, wer die Verbindung haelt.
      application_name: 'rsm2-api',
    },

    // All timestamps are TIMESTAMPTZ/UTC (Blueprint §4); keep strings out of
    // the driver's local-time guessing for plain dates.
    types: {
      date: {
        to: 1184,
        from: [1082], // DATE -> plain 'YYYY-MM-DD' string, no TZ shifting
        serialize: (v: string) => v,
        parse: (v: string) => v,
      },
    },
    onnotice: () => {
      /* silence NOTICEs from triggers in dev */
    },
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end({ timeout: 5 });
    pool = undefined;
  }
}

export type Tx = TransactionSql;

/**
 * Run `fn` inside a transaction impersonating the authenticated caller.
 * Every statement inside sees the caller's JWT claims and runs as role
 * `authenticated` - RLS policies and triggers fully apply.
 */
export async function withUser<T>(claims: AuthClaims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const sql = getPool();
  return sql.begin(async (tx) => {
    // set_config(..., true) = SET LOCAL: scoped to this transaction.
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await tx`select set_config('role', 'authenticated', true)`;
    return fn(tx);
  }) as Promise<T>;
}

/**
 * SERVICE MODE - explicitly marked system operations only (invoice number
 * sequence, webhook-driven entitlement writes, ...). Bypasses RLS; the call
 * site is responsible for authorization and must pass a reason for the log.
 */
export async function withServiceRole<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const sql = getPool();
  console.info(`[db] service-mode operation: ${reason}`);
  return sql.begin(async (tx) => {
    // No claims: service ops have no `sub` on purpose (Blueprint: service
    // tokens carry no sub; self-protection triggers do not apply).
    await tx`select set_config('request.jwt.claims', '', true)`;
    await tx`select set_config('role', 'service_role', true)`;
    return fn(tx);
  }) as Promise<T>;
}
