// ============================================================================
// lib/token.ts — Zugangstoken frisch aus der DB signieren.
//
// Der Guard `requireClubMember` liest die Vereinsrolle AUS DEM TOKEN
// (claims.club_roles[clubId]). Der Token ist eine Momentaufnahme vom Login-
// Zeitpunkt. Ändert sich die Mitgliedschaft DANACH — jemand GRÜNDET einen
// Verein (POST /clubs), ein Beitritt wird freigegeben, eine Rolle wechselt —,
// dann kennt der alte Token die neue Mitgliedschaft nicht: jede vereins-
// bezogene Route antwortet 403 „Not a member of this club", obwohl die DB die
// Person längst als Mitglied führt (RLS via app.member_role_keys liest die
// club_members-Tabelle, nicht den Claim — die DB ist also die Wahrheit).
//
// Dieser Helfer baut die club_roles NEU aus der DB und signiert einen frischen
// Token — dieselbe Form wie der Login. Genutzt von POST /auth/refresh, damit
// der Client seinen Token nach einer Mitgliedschaftsänderung (oder auf genau
// diesen 403 hin) austauschen kann, ohne dass sich die Person neu anmelden muss.
// ============================================================================

import { SignJWT } from 'jose';
import { getConfig } from '../config.js';
import { withServiceRole } from '../db.js';

/** Lebensdauer eines Zugangstokens — identisch zum Login (auth-login.ts). */
export const TOKEN_TTL_SECONDS = 12 * 60 * 60;

/**
 * club_roles aus der Rechtematrix ableiten (ein Eintrag je Verein, in dem die
 * Person eine Rolle trägt) — exakt dieselbe Abfrage wie im Login. Service-Mode,
 * eng auf das eine Profil gescoped.
 */
export async function buildClubRoles(userId: string): Promise<Record<string, string>> {
  const rows = await withServiceRole('token club_roles lookup', async (tx) => {
    return (await tx`
      select cm.club_id, r.key as role_key
        from app.member_roles mr
        join app.club_members cm on cm.id = mr.member_id and cm.deleted_at is null
        join app.roles r on r.id = mr.role_id
       where cm.profile_id = ${userId}`) as { club_id: string; role_key: string }[];
  });
  const clubRoles: Record<string, string> = {};
  for (const row of rows) clubRoles[row.club_id] = row.role_key;
  return clubRoles;
}

/**
 * Signiert einen Zugangstoken mit FRISCHEN club_roles aus der DB. Gleiche
 * Claims wie der Login (sub, role, club_roles, ggf. is_platform_admin).
 */
export async function signAccessToken(userId: string, isPlatformAdmin: boolean): Promise<string> {
  const { auth } = getConfig();
  const clubRoles = await buildClubRoles(userId);
  const claims: Record<string, unknown> = {
    sub: userId,
    role: 'authenticated',
    club_roles: clubRoles,
  };
  if (isPlatformAdmin) {
    claims['app_metadata'] = { is_platform_admin: true };
    claims['is_platform_admin'] = true;
  }
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
  if (auth.issuer !== '') jwt.setIssuer(auth.issuer);
  if (auth.audience !== '') jwt.setAudience(auth.audience);
  return jwt.sign(new TextEncoder().encode(auth.jwtSecret));
}
