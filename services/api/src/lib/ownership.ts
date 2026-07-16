// ============================================================================
// lib/ownership.ts - self-service helpers for the booking/reservation routes.
//
// facility_bookings and equipment_reservations allow a plain member to act
// FOR THEMSELVES (booked_by/reserved_by = their own club_members row) while
// coaching staff may act for anyone. These helpers answer "which member am I
// in this club" and "is this member row mine" inside the impersonated tx, so
// the API guard mirrors the RLS policy (app.is_own_member, migration 0009).
//
// ### DER MITGLIEDSCHAFTS-GATE (0037) ###
// Beide Helfer prueften bis 0037 NUR deleted_at. Damit war eine Person mit
// status='pending' - also ein Fremder, der einen richtigen Vereinscode hatte,
// aber nie freigegeben wurde -, eine ABGELEHNTE, eine ausgetretene und ein
// abgelaufener guest_coach fuer sie ein vollwertiges "ich".
//
// In der RLS ist das aufgefangen: jede Policy paart app.own_member_id mit einem
// status-gegateten has_cap/cap_rank. HIER nicht. Diese Datei ist der einzige
// Waechter an 17 Aufrufstellen (checkins.ts:87, duty-entries.ts:104/144/181,
// facility-bookings.ts:139/174, equipment-reservations.ts:98/143/178,
// waitlists.ts:102/140/174, chat.ts:52/160/198, routines.ts:364, family.ts:52).
// Ueberall steht dort 'isTrainer || isOwnMember(...)' - das IST die
// Autorisierung, und sie taugt nur so viel wie ihre zweite Haelfte.
//
// Der Gate ist WOERTLICH der aus app.member_role_keys (0025:47-49) - dieselbe
// Definition von "Mitglied", nicht eine zweite, die spaeter auseinanderlaeuft:
//     deleted_at is null AND status = 'active' AND valid_until offen
// Sein Zwilling in der DB, app.own_member_id, traegt ihn seit 0037 ebenfalls.
// ============================================================================

import type { Tx } from '../db.js';
import type { AuthClaims } from '../middleware/auth.js';

/**
 * The caller's own club_members id in this club, or null when they hold no
 * ACTIVE membership (pending / rejected / inactive / left / expired / deleted
 * all yield null).
 */
export async function ownMemberId(tx: Tx, claims: AuthClaims, clubId: string): Promise<string | null> {
  const rows = await tx`
    select id from app.club_members
    where club_id = ${clubId}
      and profile_id = ${claims.sub}
      and deleted_at is null
      and status = 'active'
      and (valid_until is null or valid_until >= now())
    limit 1`;
  return (rows[0]?.['id'] as string | undefined) ?? null;
}

/** True when the given club_members row is the caller's ACTIVE membership. */
export async function isOwnMember(tx: Tx, claims: AuthClaims, memberId: string): Promise<boolean> {
  const rows = await tx`
    select 1 from app.club_members
    where id = ${memberId}
      and profile_id = ${claims.sub}
      and deleted_at is null
      and status = 'active'
      and (valid_until is null or valid_until >= now())
    limit 1`;
  return rows.length > 0;
}
