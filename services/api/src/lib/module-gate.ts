// ============================================================================
// lib/module-gate.ts — der Modul-Schalter (0044) fuer die Handvoll Endpunkte,
// die im SERVICE-MODE laufen und deshalb die restriktiven RLS-Gates umgehen.
//
// WARUM DAS UEBERHAUPT NOETIG IST
// ---------------------------------------------------------------------------
// 0044 setzt Modul-Schalter als restriktive RLS-Policies durch. Das gilt fuer
// JEDE Route, die impersoniert liest/schreibt (withUser) — auch fuer die, die
// es noch nicht gibt. Die EINE Luecke ist withServiceRole: service_role hat
// BYPASSRLS (db.ts), die Gates greifen dort nicht.
//
// Fuer 'finance' (0061) soll der Schalter aber VOLLSTAENDIG dicht sein. Die
// wenigen Finanz-Endpunkte im Service-Mode (reports/summary, reports/annual,
// invoices POST, donations POST, budgets report) ziehen den Modul-Check darum
// hier explizit im Code nach — sonst waere 'enforced' an genau diesen Stellen
// eine Luege (0033-Muster: ehrlich benannt, wirklich durchgesetzt).
//
// app.module_enabled(club_id, key) ist SECURITY DEFINER + STABLE (0044) und
// liefert die Schalterstellung unabhaengig von der aufrufenden Rolle — im
// Service-Mode genauso wie unter withUser.
//
// ### NACHTRAG 0068 — DIE ZWEITE AUFGABE DIESER DATEI ########################
// Seit 0068 sind Galerie, Dokumente und Notizen ZUBUCHBAR: fuer einen neuen
// Verein voreingestellt AUS. Diese drei laufen unter withUser, die RLS-Gates
// greifen dort also ohnehin. Sie rufen assertModuleEnabled trotzdem — aus einem
// anderen Grund als die Finanz-Endpunkte oben:
//
//   Finanz-Endpunkte: die RLS greift NICHT (service_role) -> der Check ist die
//                     einzige Durchsetzung.
//   Zubuchbare Module: die RLS greift, liefert aber eine LEERE LISTE. Ein leeres
//                     Array kann nicht zwischen "keine Dokumente vorhanden" und
//                     "nicht gebucht" unterscheiden — und der Verein wuerde
//                     denken, seine Dokumente sind weg. Der Check macht daraus
//                     eine klare, maschinenlesbare Auskunft (403 +
//                     MODULE_DISABLED_CODE), auf die Web und iOS den ehrlichen
//                     "nicht gebucht"-Zustand haengen.
//
// Faellt der Check bei einer neuen Route einmal aus (vergessen), bleibt die RLS
// als zweite Verteidigungslinie stehen: die Daten kommen trotzdem nicht heraus,
// nur die Fehlermeldung ist weniger hilfreich. Der Check darf die RLS ergaenzen,
// niemals ersetzen.
//
// ### 402 ODER 403 — ZWEI URSACHEN, ZWEI AUSWEGE ############################
// 402 (lib/pro-gate.ts) = NICHT LIZENZIERT; der Betreiber muss freischalten.
// 403 (hier)            = NICHT GEBUCHT/abgeschaltet; ein Vereins-Admin schaltet
//                         es unter Verwaltung > Module ein.
// Bei Galerie/Dokumente koennen BEIDE zutreffen. Die Routen pruefen deshalb in
// fester Reihenfolge erst PRO, dann Modul — sonst bekaeme ein Verein ohne Lizenz
// den Rat, einen Schalter umzulegen, der ihm nicht hilft.
// ============================================================================

import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';

/**
 * Stabiler Bezeichner, auf den Web und iOS matchen, um den ehrlichen
 * "nicht gebucht"-Zustand zu zeigen (Gegenstueck zu PRO_REQUIRED_CODE).
 * Steckt als Praefix im RFC-7807-`detail` und wird von Status 403 begleitet.
 */
export const MODULE_DISABLED_CODE = 'club_module_disabled';

/**
 * Zweisprachige Klartexte fuer die zubuchbaren Module — der Nutzer liest den
 * Fehler, nicht den Schluessel. Unbekannte Schluessel fallen auf den generischen
 * Text zurueck (die Finanz-Endpunkte brauchen keinen Sondertext).
 */
const MODULE_LABEL: Record<string, { de: string; en: string }> = {
  gallery: { de: 'Die Galerie', en: 'The gallery module' },
  document: { de: 'Die Dokumente', en: 'The documents module' },
  notes: { de: 'Die Notizen', en: 'The notes module' },
};

/** Ist das Modul fuer diesen Verein eingeschaltet? Fehlende Zeile = app.modules.default_enabled (0068). */
export async function isModuleEnabled(
  tx: Tx,
  clubId: string,
  moduleKey: string,
): Promise<boolean> {
  const rows = await tx`select app.module_enabled(${clubId}, ${moduleKey}) as enabled`;
  return (rows[0] as { enabled: boolean } | undefined)?.enabled === true;
}

/**
 * Wirft 403, wenn das Modul fuer diesen Verein nicht gebucht bzw. ausgeschaltet
 * ist.
 *
 * Zwei Aufrufergruppen, siehe Kopf:
 *   * Finanz-Endpunkte im Service-Mode — hier ist der Check die EINZIGE
 *     Durchsetzung (RLS greift wegen BYPASSRLS nicht).
 *   * Zubuchbare Module (Galerie/Dokumente/Notizen, 0068) unter withUser — hier
 *     ergaenzt der Check die RLS um eine EHRLICHE Auskunft statt einer leeren
 *     Liste.
 *
 * Das `detail` traegt MODULE_DISABLED_CODE als Praefix, damit die Clients den
 * Fall sicher erkennen, ohne Klartext zu parsen.
 */
export async function assertModuleEnabled(
  tx: Tx,
  clubId: string,
  moduleKey: string,
): Promise<void> {
  if (await isModuleEnabled(tx, clubId, moduleKey)) return;

  const label = MODULE_LABEL[moduleKey]
    ?? { de: `Das Modul "${moduleKey}"`, en: `Module "${moduleKey}"` };
  throw problem(
    403,
    'Forbidden',
    `${MODULE_DISABLED_CODE}: ${label.de} ist für diesen Verein nicht gebucht. `
      + `Ein Vereins-Admin kann das Modul unter Verwaltung › Module einschalten. / `
      + `${label.en} is not booked for this club. `
      + `A club admin can switch it on under Administration › Modules.`,
  );
}
