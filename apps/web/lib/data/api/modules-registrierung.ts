import type {
  JoinClubInput,
  JoinCodeState,
  JoinRequestResult,
  PendingJoinRequest,
  RegisterClubInput,
  RegisteredClub,
  RegistrierungRepository,
} from "../inputs-registrierung";
import { activeClubId, apiClient } from "./client";

/**
 * API-Implementierung der Registrierung (Migration 0034).
 *
 * Nutzt ausschliesslich den GENERIERTEN Client — die Methoden entstehen aus
 * dem Vertrag (packages/contracts), nicht aus handgeschriebenen fetch-Aufrufen.
 *
 * HIER WIRD NICHTS VORGEPRUEFT. Wer den Code kennt, bekommt vom Server einen
 * ANTRAG (status='pending') und keinen Zugang; ob ein Code stimmt, weiss allein
 * der Server, und er sagt bei jedem Fehlschlag dasselbe (404), damit sich Codes
 * nicht durchprobieren lassen. Jede Klugheit im Client waere hier entweder
 * wirkungslos oder ein Orakel.
 */

export const moduleApiRepositoryRegistrierung: RegistrierungRepository = {
  async registerClub(input: RegisterClubInput): Promise<RegisteredClub> {
    const res = await apiClient.postClubs({
      name: input.name,
      city: input.city,
      ...(input.shortName !== undefined && input.shortName !== ""
        ? { short_name: input.shortName }
        : {}),
      ...(input.discipline !== undefined && input.discipline !== ""
        ? { discipline: input.discipline }
        : {}),
      accept_terms: true,
      accept_privacy: true,
    });
    return {
      clubId: res.club.id,
      clubName: res.club.name,
      joinCode: res.join_code,
      trialEndsAt: res.trial_ends_at,
      ownerMemberId: res.member.id,
    };
  },

  async requestJoin(input: JoinClubInput): Promise<JoinRequestResult> {
    const res = await apiClient.postClubsJoin({
      code: input.code,
      first_name: input.firstName,
      last_name: input.lastName,
      accept_terms: true,
      accept_privacy: true,
    });
    return {
      clubId: res.club_id,
      clubName: res.club_name,
      memberId: res.member_id,
      status: res.status,
    };
  },

  async getPendingJoinRequests(): Promise<PendingJoinRequest[]> {
    // Es gibt keine eigene Route: der Roster IST die Antragsliste (status
    // 'pending' ist eine club_members-Zeile, keine zweite Tabelle). Genau das
    // ist der Kern von 0034 — ein Antrag braucht kein eigenes Schema.
    const members = await apiClient.getClubsByClubIdMembers(activeClubId());
    return members
      .filter((m) => m.status === "pending")
      .map((m) => ({
        memberId: m.id,
        firstName: m.first_name,
        lastName: m.last_name,
        requestedAt: m.created_at,
      }));
  },

  async approveJoinRequest(memberId: string): Promise<void> {
    await apiClient.postClubsByClubIdMembersByMemberIdApprove(activeClubId(), memberId);
  },

  async rejectJoinRequest(memberId: string): Promise<void> {
    await apiClient.postClubsByClubIdMembersByMemberIdReject(activeClubId(), memberId);
  },

  async getJoinCodeState(): Promise<JoinCodeState> {
    // Eigene Adresse statt Feld am Club-Objekt (0035/0041): der Code fuhr bis
    // dahin in JEDER Vereinsantwort mit und wurde nur von der API redigiert.
    // Das Leserecht auf app.clubs.join_code ist der Rolle `authenticated`
    // inzwischen in der Datenbank entzogen — `Club.join_code` gibt es nicht
    // mehr, weder im Vertrag noch in der Spalte.
    //
    // Wer nicht darf (nicht owner/admin/moderator), bekommt hier ein 403 —
    // KEIN stilles null. Das ist Absicht: ein null haette der Oberflaeche
    // erlaubt, so zu tun, als gaebe es keinen Code.
    const res = await apiClient.getClubsByClubIdJoinCode(activeClubId());
    return {
      clubId: res.club_id,
      joinCode: res.join_code,
      expiresAt: res.join_code_expires_at,
      revokedAt: res.join_code_revoked_at,
    };
  },

  async rotateJoinCode(expiresInDays?: number | null): Promise<JoinCodeState> {
    const res = await apiClient.postClubsByClubIdJoinCodeRotate(activeClubId(), {
      expires_in_days: expiresInDays ?? null,
    });
    return {
      clubId: res.club_id,
      joinCode: res.join_code,
      expiresAt: res.join_code_expires_at,
      revokedAt: null,
    };
  },

  async revokeJoinCode(): Promise<JoinCodeState> {
    const res = await apiClient.postClubsByClubIdJoinCodeRevoke(activeClubId());
    return {
      clubId: res.club_id,
      joinCode: null,
      expiresAt: null,
      revokedAt: res.join_code_revoked_at,
    };
  },
};
