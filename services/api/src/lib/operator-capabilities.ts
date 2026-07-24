// ============================================================================
// lib/operator-capabilities.ts — die Allowlist des Auftragsverarbeiters,
// in der API lesbar.
//
// ### Warum es diese Datei ueberhaupt gibt ###
// Die Zweckbindung aus 0074 lebte bisher NUR in SQL. Das war keine halbe
// Sache aus Bequemlichkeit, sondern ein blinder Fleck mit einer belegten Folge:
// die Kontaktdaten-Maskierung des Rosters ist ein reiner TypeScript-Gate
// (routes/members.ts -> maySeeFullRoster -> lib/guards.ts). SQL kam dort nie
// vorbei, also griff die Zweckbindung dort nicht — der Betreiber las
// Geburtsdatum, Telefon und Anschrift von Kindern, waehrend dieselbe Person
// ueber /coach-notes und /locker-rentals sauber ausgesperrt war.
//
// Zwei Schichten mit eigenen Regeln sind keine Sicherheit, sondern zwei
// Wahrheiten. Also gibt es hier dieselbe Liste — und einen Test, der beweist,
// dass es DIESELBE ist.
//
// ### Warum eine Konstante und keine Abfrage ###
// Der Gegenvorschlag waere, die Allowlist bei jedem Request aus
// app.operator_capabilities zu lesen. Dagegen sprechen zwei Dinge:
//   * lib/guards.ts ist mit Absicht eine Sammlung REINER, synchroner Funktionen
//     (unit-testbar ohne DB, siehe Kopf dort). Ein await in hasClubRole zoege
//     eine DB-Abfrage in jede Maskierungs-Entscheidung jeder Roster-Zeile.
//   * Die Tabelle ist zur LAUFZEIT unveraenderlich (0074, Abschnitt 2: drei
//     Trigger, auch gegen service_role). Sie kann sich zwischen zwei Requests
//     gar nicht aendern — nur durch eine Migration. Etwas abzufragen, das sich
//     nur beim Deploy aendert, ist keine Frische, sondern Aufwand.
//
// Das Auseinanderlaufen verhindert deshalb kein Cache, sondern ein GATE:
// services/api/test/operator-capabilities.mirror.test.ts liest die Migration
// 0074 (und jede spaetere, die app.operator_capabilities anfasst) und
// vergleicht sie Zeichen fuer Zeichen mit dieser Liste. Wer die eine aendert
// und die andere vergisst, bekommt einen roten Test, keinen stillen Bruch.
// ============================================================================

import type { AuthClaims } from '../middleware/auth.js';
import { hasOperatorOverride } from './operator-context.js';

/**
 * Die Faehigkeiten, in denen die protokollierte Betreiber-Einsicht wirkt.
 *
 * WORTGLEICH zu den `insert into app.operator_capabilities`-Zeilen in
 * supabase/migrations/0074_betreiber_zweckbindung.sql. Wer hier etwas
 * hinzufuegt, ohne die Migration zu aendern, veraendert NICHTS an der
 * Datenbank — er baut nur eine API, die mehr durchlaesst, als RLS erlaubt,
 * und bekommt statt Daten ein 42501. Der Spiegel-Test faellt vorher auf.
 */
export const OPERATOR_CAPABILITIES: ReadonlySet<string> = new Set([
  'members',
  'roles',
  'club_settings',
  'departments',
  'teams',
  'team_coaches',
  'routines',
  'routines_edit',
  'anniversaries',
]);

/**
 * Das TypeScript-Gegenstueck zu app.operator_may(capability).
 *
 * Verlangt BEIDES, genau wie SQL:
 *   * die EINGESCHALTETE Einsicht (hasOperatorOverride) — die setzt nur
 *     middleware/operator-access.ts, und zwar erst, wenn der Zugriff
 *     protokolliert werden kann. Der blosse Plattform-Admin-Claim bewirkt hier
 *     so wenig wie in der Datenbank.
 *   * einen Eintrag in der Allowlist. Nicht gelistet = false, auch fuer den
 *     Plattform-Admin (fail-closed, Art. 25 Abs. 2 DSGVO).
 */
export function operatorMay(claims: AuthClaims, capability: string): boolean {
  return hasOperatorOverride(claims) && OPERATOR_CAPABILITIES.has(capability);
}

/**
 * Die Faehigkeitsschluessel, die der API-Code an operatorMay/hasClubRole
 * uebergeben darf — der Katalog aus 0023/0028/0031/0069.
 *
 * Rein fuer die Typpruefung: ein Tippfehler ('member_contacts') waere sonst
 * eine stille Dauer-Sperre, die niemand mehr findet, weil sie sich exakt wie
 * eine bewusste Sperre verhaelt. Mit dem Union-Typ ist er ein Compilerfehler.
 */
export type CapabilityKey =
  | 'members'
  | 'member_contact'
  | 'roles'
  | 'club_settings'
  | 'departments'
  | 'teams'
  | 'team_coaches'
  | 'events'
  | 'competitions'
  | 'tasks'
  | 'routines'
  | 'routines_edit'
  | 'attendance'
  | 'training_slots'
  | 'exercises'
  | 'achievements'
  | 'news'
  | 'media'
  | 'documents'
  | 'gallery'
  | 'chat'
  | 'equipment'
  | 'equipment_reservations'
  | 'facilities'
  | 'facilities_booking'
  | 'lockers'
  | 'finance'
  | 'duty_hours'
  | 'waitlists'
  | 'checkins'
  | 'regional_events'
  | 'anniversaries'
  | 'coach_notes';
