/**
 * Registrierung — Vereins-Selbstanlage, Beitritt per Code, Freigabe.
 *
 * Serverseitig: services/api/src/routes/clubs.ts (POST /clubs) und
 * routes/registration.ts (join/approve/reject/rotate/revoke), Migration 0034.
 *
 * DIE EINE REGEL, die man beim Lesen der Typen kennen muss:
 * Ein richtiger Vereinscode ist ein ANTRAG, kein ZUTRITT. `JoinRequestResult.
 * status` ist deshalb immer "pending" — die Oberflaeche darf niemals so tun,
 * als waere man schon drin. Die Freigabe macht der Vorstand.
 */

export interface RegisterClubInput {
  name: string;
  city: string;
  shortName?: string;
  discipline?: string;
  /** Ohne Zustimmung keine Anlage — der Server prueft es ebenfalls (z.literal(true)). */
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface RegisteredClub {
  clubId: string;
  clubName: string;
  /** Anzeigeform XXXX-XXXX. Nur der Anlegende und Code-Verwalter sehen ihn. */
  joinCode: string;
  /** Ende der Testphase (ISO-Zeitpunkt). */
  trialEndsAt: string;
  ownerMemberId: string;
}

export interface JoinClubInput {
  /** Tippfehler-tolerant (Crockford: 0/O und 1/I/L sind dasselbe). */
  code: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface JoinRequestResult {
  clubId: string;
  clubName: string;
  memberId: string;
  /** Immer "pending" — ein Code oeffnet die Warteschlange, nicht die Tuer. */
  status: string;
}

/** Ein offener Beitrittsantrag in der Freigabe-Liste des Vorstands. */
export interface PendingJoinRequest {
  memberId: string;
  firstName: string;
  lastName: string;
  requestedAt: string;
}

export interface JoinCodeState {
  clubId: string;
  /**
   * null = fuer diesen Verein ist kein Code hinterlegt.
   *
   * NICHT mehr "darf nicht sehen": wer nicht owner/admin/moderator ist, laeuft
   * seit 0035/0041 in ein 403 (GET /clubs/{id}/join-code) statt ein redigiertes
   * null zu bekommen. Der Code hat eine eigene Adresse und einen Gate in der
   * Datenbank; die Oberflaeche redigiert nichts mehr.
   */
  joinCode: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/**
 * Oeffentliche Vorschau einer Einladung (GET /public/invitations/{token}).
 * Nur Vereinsname und Zielrolle — kein Personendatum, kein Absender, kein
 * Hinweis auf Mitgliedschaft. Ungueltig/abgelaufen/verbraucht -> Fehler (404).
 */
export interface InvitationInfo {
  clubName: string;
  /** Rolle, die die Mitgliedschaft bei Annahme bekommt (z.B. "member"). */
  role: string;
}

/** Eine Einladung annehmen. Token aus der URL + Name + die beiden Pflicht-Haken. */
export interface AcceptInvitationInput {
  token: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

/** Ergebnis der Annahme: die frisch entstandene AKTIVE Mitgliedschaft. */
export interface AcceptedInvitation {
  clubId: string;
  clubName: string;
  memberId: string;
  /** Immer "active" — die Einladung IST die Freigabe (anders als der Code). */
  status: string;
}

export interface RegistrierungRepository {
  /** Verein selbst anlegen — der Aufrufer wird Inhaber (owner, active). */
  registerClub(input: RegisterClubInput): Promise<RegisteredClub>;
  /** Beitritt BEANTRAGEN. Falscher Code -> Fehler, der nicht verraet, warum. */
  requestJoin(input: JoinClubInput): Promise<JoinRequestResult>;
  /** Offene Antraege des Vereins (status=pending). */
  getPendingJoinRequests(): Promise<PendingJoinRequest[]>;
  /** Antrag freigeben (pending -> active). Wirkt sofort, ohne Re-Login. */
  approveJoinRequest(memberId: string): Promise<void>;
  /** Antrag ablehnen. Keine Sperre — die Person darf erneut fragen. */
  rejectJoinRequest(memberId: string): Promise<void>;
  /** Aktueller Code-Zustand (Code, Ablauf, Widerruf). */
  getJoinCodeState(): Promise<JoinCodeState>;
  /** Neuen Code erzeugen — der alte ist sofort wertlos. */
  rotateJoinCode(expiresInDays?: number | null): Promise<JoinCodeState>;
  /** Code sperren, ohne einen neuen zu erzeugen. */
  revokeJoinCode(): Promise<JoinCodeState>;
  /**
   * Oeffentliche Vorschau einer Einladung (kein Login noetig). Ungueltiger
   * Token -> Fehler; die Annahme-Seite zeigt dann eine neutrale Meldung.
   */
  getInvitation(token: string): Promise<InvitationInfo>;
  /** Einladung annehmen -> aktive Mitgliedschaft. Der Token ist danach verbraucht. */
  acceptInvitation(input: AcceptInvitationInput): Promise<AcceptedInvitation>;
}
