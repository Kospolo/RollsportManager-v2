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
// ============================================================================

import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';

/** Ist das Modul fuer diesen Verein eingeschaltet? Fehlende Zeile = an (0044). */
export async function isModuleEnabled(
  tx: Tx,
  clubId: string,
  moduleKey: string,
): Promise<boolean> {
  const rows = await tx`select app.module_enabled(${clubId}, ${moduleKey}) as enabled`;
  return (rows[0] as { enabled: boolean } | undefined)?.enabled === true;
}

/**
 * Wirft 403, wenn das Modul fuer diesen Verein ausgeschaltet ist. Fuer
 * REIN-Finanz-Endpunkte (annual/budgets/invoice-create/donation-create): ist
 * finance aus, gibt es nichts anzuzeigen und nichts anzulegen. Das UI blendet
 * die Bereiche ohnehin aus (Modul-Status) und laeuft nie hier hinein — der 403
 * ist die ehrliche Server-Grenze, nicht die Anzeige.
 */
export async function assertModuleEnabled(
  tx: Tx,
  clubId: string,
  moduleKey: string,
): Promise<void> {
  if (!(await isModuleEnabled(tx, clubId, moduleKey))) {
    throw problem(
      403,
      'Forbidden',
      `Das Modul "${moduleKey}" ist fuer diesen Verein ausgeschaltet. / Module "${moduleKey}" is switched off for this club.`,
    );
  }
}
