// ============================================================================
// lib/operator-context.ts — die Markierung "Betreiber-Einsicht ist EIN".
//
// ### Warum ein Symbol und kein Claim-Feld ###
// Die Markierung darf unter keinen Umstaenden aus dem Token stammen koennen.
// Ein zusaetzliches Claim-Feld waere dafuer die naheliegende, aber falsche
// Wahl: authClaimsSchema ist .passthrough() (middleware/auth.ts:58), ein Token
// darf also beliebige Zusatzfelder tragen. Man muesste sie beim Einlesen
// wegstreichen und daran fuer immer denken.
//
// Ein Symbol-Schluessel loest das ENDGUELTIG statt sorgfaeltig:
//   * Ein JWT ist JSON. JSON kennt keine Symbole. Ein Token kann diesen
//     Schluessel also nicht tragen — nicht "sollte nicht", sondern KANN NICHT.
//   * JSON.stringify ignoriert Symbol-Schluessel. db.ts serialisiert die Claims
//     nach request.jwt.claims — die Markierung faellt dabei automatisch heraus.
//     Die Zusage aus db.ts:16 ("die Datenbank sieht EXAKT das, was das Token
//     gesagt hat, nichts mehr") bleibt damit woertlich wahr. Der Schalter geht
//     nicht als Claim in die DB, sondern als eigene Sitzungsvariable.
//   * Das Symbol ist modul-lokal. Es steht in keinem export, ausser durch die
//     zwei Funktionen unten — von aussen ist es nicht einmal adressierbar.
//
// Gesetzt wird die Markierung an genau EINER Stelle: middleware/operator-access.ts,
// nachdem der Zugriff protokolliert werden KONNTE. Gelesen wird sie an zwei:
// db.ts (setzt daraus app.operator_override in der Transaktion) und den Gates
// (lib/guards.ts, lib/capabilities.ts).
// ============================================================================

import type { AuthClaims } from '../middleware/auth.js';

/**
 * Der Schluessel. Modul-lokal und nicht exportiert — wer die Markierung setzen
 * will, muss durch markOperatorAccess() gehen, und das tut nur die Middleware.
 * KEIN Symbol.for(): ein globales Register waere von jedem Modul aus erreichbar.
 */
const OPERATOR_OVERRIDE = Symbol('rsm.operator_override');

/**
 * Schaltet die Betreiber-Einsicht fuer DIESEN Request ein.
 *
 * Aufrufer: ausschliesslich middleware/operator-access.ts. Der Aufruf ist
 * unwirksam, solange die Person nicht ohnehin einen signierten Plattform-Admin-
 * Claim traegt — die DB verlangt in app.operator_override() BEIDES (Claim UND
 * Sitzungsvariable), diese Markierung allein bewirkt dort gar nichts.
 */
export function markOperatorAccess(claims: AuthClaims): void {
  (claims as unknown as Record<symbol, unknown>)[OPERATOR_OVERRIDE] = true;
}

/** Ist die Betreiber-Einsicht fuer diesen Request eingeschaltet? */
export function hasOperatorOverride(claims: AuthClaims): boolean {
  return (claims as unknown as Record<symbol, unknown>)[OPERATOR_OVERRIDE] === true;
}
