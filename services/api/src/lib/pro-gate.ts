// ============================================================================
// lib/pro-gate.ts - the server-side PRO gate for Galerie & Dokumente
// (Referenz 4 "PRO-Gating"). v1 checked checkPremiumAccess() in the client;
// v2 enforces it in the DB (app.is_club_pro, migration 0012). This helper is
// the API-layer mirror so we can return a CLEAR, machine-detectable 402 with an
// upgrade hint BEFORE hitting RLS (which would otherwise surface as a generic
// 403). RLS remains the second line of defense.
// ============================================================================

import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';

/**
 * Stable identifier the web/mobile clients match on to show the upgrade hint.
 * Carried in the RFC 7807 problem `detail` (prefix) AND signalled by status 402.
 */
export const PRO_REQUIRED_CODE = 'club_pro_required';

/**
 * Throw HTTP 402 unless the club holds an active pro/premium entitlement.
 * MUST run inside a withUser() transaction (uses the impersonated app.is_club_pro
 * so a platform admin passes too, exactly like the RLS gate).
 */
export async function assertClubPro(tx: Tx, clubId: string): Promise<void> {
  const rows = await tx`select app.is_club_pro(${clubId}) as pro`;
  if (rows[0]?.['pro'] !== true) {
    throw problem(
      402,
      'Payment Required',
      `${PRO_REQUIRED_CODE}: Galerie und Dokumente erfordern eine aktive PRO- oder Premium-Vereinslizenz. / The gallery and documents modules require an active PRO or Premium club licence.`,
    );
  }
}
