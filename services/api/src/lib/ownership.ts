// ============================================================================
// lib/ownership.ts - self-service helpers for the booking/reservation routes.
//
// facility_bookings and equipment_reservations allow a plain member to act
// FOR THEMSELVES (booked_by/reserved_by = their own club_members row) while
// coaching staff may act for anyone. These helpers answer "which member am I
// in this club" and "is this member row mine" inside the impersonated tx, so
// the API guard mirrors the RLS policy (app.is_own_member, migration 0009).
// ============================================================================

import type { Tx } from '../db.js';
import type { AuthClaims } from '../middleware/auth.js';

/** The caller's own club_members id in this club, or null when not a member. */
export async function ownMemberId(tx: Tx, claims: AuthClaims, clubId: string): Promise<string | null> {
  const rows = await tx`
    select id from app.club_members
    where club_id = ${clubId} and profile_id = ${claims.sub} and deleted_at is null
    limit 1`;
  return (rows[0]?.['id'] as string | undefined) ?? null;
}

/** True when the given club_members row belongs to the caller. */
export async function isOwnMember(tx: Tx, claims: AuthClaims, memberId: string): Promise<boolean> {
  const rows = await tx`
    select 1 from app.club_members
    where id = ${memberId} and profile_id = ${claims.sub} and deleted_at is null
    limit 1`;
  return rows.length > 0;
}
