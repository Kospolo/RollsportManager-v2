// ============================================================================
// operator-capabilities-mirror.test.ts — EINE Wahrheit, nicht zwei Schichten
// mit eigenen Regeln.
//
// src/lib/operator-capabilities.ts fuehrt die Betreiber-Allowlist als
// Konstante (Begruendung im Kopf dort: guards.ts ist synchron und rein, und die
// Tabelle ist zur Laufzeit unveraenderlich). Eine Kopie ist nur so lange
// harmlos, wie jemand beweist, dass sie eine Kopie IST.
//
// Dieser Test liest die WIRKLICHE Quelle — die insert-Zeilen in
// supabase/migrations/*.sql, die app.operator_capabilities fuellen — und
// vergleicht sie mit der Konstante. Wer eine spaetere Migration schreibt, die
// eine Faehigkeit freigibt, und die TS-Liste vergisst, bekommt hier rot statt
// eines stillen Auseinanderlaufens (die API wuerde sonst maskieren, wo RLS
// laengst durchliesse — oder, weit schlimmer, andersherum).
// ============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OPERATOR_CAPABILITIES } from '../src/lib/operator-capabilities.js';

const MIGRATIONS = fileURLToPath(new URL('../../../supabase/migrations', import.meta.url));

/**
 * Liest die Allowlist aus den Migrationen nach: alle Schluessel, die in einen
 * `insert into app.operator_capabilities`-Block eingetragen werden, minus
 * alles, was eine spaetere Migration wieder loescht.
 *
 * Bewusst eine schlichte Textauswertung und keine Datenbank: dieser Test soll
 * ohne Harness laufen (vitest ist DB-frei). Die DB-Seite derselben Zusage
 * misst supabase/tests/sql/99q_betreiber_zweckbindung.sql.
 */
function allowlistFromMigrations(): Set<string> {
  const keys = new Set<string>();
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    if (!sql.includes('app.operator_capabilities')) continue;

    // insert into app.operator_capabilities (…) values ('key', 'grund', 'reason'), …;
    //
    // Das Statement-Ende wird ZEICHENWEISE gesucht und nicht per /…;/ — die
    // Begruendungen sind Fliesstext und enthalten Semikolons ("Dieselbe
    // Begruendung wie departments; ausserdem …"). Eine nicht-gierige Regex
    // haette dort abgebrochen und vier von neun Freigaben uebersehen: der Test
    // waere gruen gewesen und haette nichts bewiesen.
    for (const start of sql.matchAll(/insert\s+into\s+app\.operator_capabilities[\s\S]*?values/gi)) {
      const from = (start.index ?? 0) + start[0].length;
      let i = from;
      let inString = false;
      while (i < sql.length) {
        const ch = sql[i];
        if (inString) {
          if (ch === "'") {
            if (sql[i + 1] === "'") i += 1; // '' = escapetes Anfuehrungszeichen
            else inString = false;
          }
        } else if (ch === "'") inString = true;
        else if (ch === ';') break;
        i += 1;
      }
      for (const row of sql.slice(from, i).matchAll(/\(\s*'([a-z_]+)'/g)) {
        keys.add(row[1] as string);
      }
    }
    for (const del of sql.matchAll(
      /delete\s+from\s+app\.operator_capabilities[\s\S]*?capability_key\s*=\s*'([a-z_]+)'/gi,
    )) {
      keys.delete(del[1] as string);
    }
  }
  return keys;
}

describe('die Betreiber-Allowlist steht in der Migration und in TypeScript — identisch', () => {
  it('findet die Quelle ueberhaupt (sonst waere der Test gruen und blind)', () => {
    expect(allowlistFromMigrations().size).toBeGreaterThan(0);
  });

  it('TypeScript-Konstante == app.operator_capabilities aus den Migrationen', () => {
    expect([...OPERATOR_CAPABILITIES].sort()).toEqual([...allowlistFromMigrations()].sort());
  });

  it('die Liste ist echt kleiner als der Faehigkeiten-Katalog', () => {
    // Waere sie es nicht, waere die Zweckbindung wieder der Generalschluessel —
    // dieselbe Nachrechnung wie 0074, Abschnitt 9(b), nur von der API-Seite.
    const catalog = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .flatMap((f) => [
        ...readFileSync(join(MIGRATIONS, f), 'utf8').matchAll(
          /insert\s+into\s+app\.capabilities[\s\S]*?values([\s\S]*?)on\s+conflict|insert\s+into\s+app\.capabilities[\s\S]*?values([\s\S]*?);/gi,
        ),
      ])
      .flatMap((m) => [...((m[1] ?? m[2] ?? '') as string).matchAll(/\(\s*'([a-z_]+)'/g)].map((r) => r[1]));
    expect(new Set(catalog).size).toBeGreaterThan(OPERATOR_CAPABILITIES.size);
  });
});
