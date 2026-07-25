// GENERIERT — NICHT VON HAND AENDERN
//
// Generated from packages/contracts/openapi.json (RollsportManager v2 API v0.2.0).
// Regenerate with: npm run generate   (in packages/contracts)
// Source of truth is the API layer; the spec itself is produced by
// "npm run openapi" in services/api - never edit either by hand.

/* eslint-disable */

import type * as M from "./types";

export interface RequestOptions {
  signal?: AbortSignal;
  /** Extra headers for this single request (e.g. x-request-id). */
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  /** Base URL of the API, e.g. "http://localhost:3022" - no trailing slash needed. */
  baseUrl: string;
  /** Returns the current GoTrue access token (or null for anonymous calls). */
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Custom fetch implementation (tests, Node polyfills). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Headers applied to every request. */
  defaultHeaders?: Record<string, string>;
}

/** RFC 7807 error thrown for every non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: M.Problem | null;

  constructor(status: number, problem: M.Problem | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export class ApiClient {
  private readonly opts: ApiClientOptions;

  constructor(opts: ApiClientOptions) {
    this.opts = opts;
  }

  private async request<T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown; auth: boolean; options?: RequestOptions }
  ): Promise<T> {
    const base = this.opts.baseUrl.replace(/\/+$/, "");
    const url = new URL(base + path);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      accept: "application/json",
      ...this.opts.defaultHeaders,
      ...init.options?.headers,
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.auth && this.opts.getAccessToken) {
      const token = await this.opts.getAccessToken();
      if (token) headers["authorization"] = `Bearer ${token}`;
    }

    const doFetch = this.opts.fetch ?? globalThis.fetch;
    const res = await doFetch(url.toString(), {
      method: method.toUpperCase(),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.options?.signal,
    });

    if (!res.ok) {
      let problem: M.Problem | null = null;
      try {
        problem = (await res.json()) as M.Problem;
      } catch {
        // non-JSON error body - keep problem null
      }
      const detail = problem?.detail ?? problem?.title ?? res.statusText;
      throw new ApiError(res.status, problem, `${method.toUpperCase()} ${path} -> ${res.status}: ${detail}`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  /**
   * Liveness probe (no auth, no DB)
   * 
   * `GET /health`
   */
  async getHealth(options?: RequestOptions): Promise<M.Health> {
    return this.request<M.Health>("GET", "/health", { auth: false, options });
  }

  /**
   * List clubs of the current user (RLS-scoped)
   * 
   * `GET /clubs`
   */
  async getClubs(options?: RequestOptions): Promise<M.Club[]> {
    return this.request<M.Club[]>("GET", "/clubs", { auth: true, options });
  }

  /**
   * Verein selbst anlegen (Testphase) / Register a club (trial)
   * Legt einen Verein an und macht die aufrufende Person zur Inhaberin (owner, active) - inklusive Rollenzuweisung, sonst haette sie im eigenen Verein NULL Rechte (app.member_role_keys, 0025:37-53). Setzt eine 30-Tage-Testphase (Entitlement club_license, metadata.status=trial) und erzeugt den ersten Vereinscode. Erfordert eine Anmeldung (fuer den Inhaber-Bezug), aber KEINE Vereinszugehoerigkeit.
   * 
   * `POST /clubs`
   */
  async postClubs(body: M.ClubRegistration, options?: RequestOptions): Promise<M.ClubRegistrationResult> {
    return this.request<M.ClubRegistrationResult>("POST", "/clubs", { body, auth: true, options });
  }

  /**
   * Get a single club
   * 
   * `GET /clubs/{clubId}`
   */
  async getClubsByClubId(clubId: string, options?: RequestOptions): Promise<M.Club> {
    return this.request<M.Club>("GET", `/clubs/${encodeURIComponent(clubId)}`, { auth: true, options });
  }

  /**
   * Update own club (owner/admin)
   * 
   * `PATCH /clubs/{clubId}`
   */
  async patchClubsByClubId(clubId: string, body: M.ClubUpdate, options?: RequestOptions): Promise<M.Club> {
    return this.request<M.Club>("PATCH", `/clubs/${encodeURIComponent(clubId)}`, { body, auth: true, options });
  }

  /**
   * Vereinscode lesen (owner/admin/moderator) / Read the club join code
   * Liefert den juengsten Einladungscode des Vereins. Erfordert owner, admin oder moderator - dieselbe Rollenliste, die den Code rotieren und widerrufen darf: wer ihn sieht, kann ihn auch einziehen. Der Code steht seit 0035 NICHT mehr am Club-Objekt (GET /clubs lieferte ihn bis dahin an jedes Mitglied, auch an Kinder); das Leserecht auf die Spalte ist der Rolle authenticated in der Datenbank entzogen. / Returns the club's most recent invite code. Requires owner, admin or moderator.
   * 
   * `GET /clubs/{clubId}/join-code`
   */
  async getClubsByClubIdJoinCode(clubId: string, options?: RequestOptions): Promise<M.ClubJoinCode> {
    return this.request<M.ClubJoinCode>("GET", `/clubs/${encodeURIComponent(clubId)}/join-code`, { auth: true, options });
  }

  /**
   * Vereins-SMTP lesen (is_club_admin) / Read a club SMTP config
   * Liefert die SMTP-Konfiguration des Vereins (Host/Port/User/Absender/SSL). Das Passwort wird NIE im Klartext geliefert — nur smtp_password_set:boolean zeigt, ob eines hinterlegt ist. Erfordert is_club_admin (owner/admin/moderator). / Returns the club SMTP config; password masked.
   * 
   * `GET /clubs/{clubId}/smtp`
   */
  async getClubsByClubIdSmtp(clubId: string, options?: RequestOptions): Promise<M.ClubSmtp> {
    return this.request<M.ClubSmtp>("GET", `/clubs/${encodeURIComponent(clubId)}/smtp`, { auth: true, options });
  }

  /**
   * Vereins-SMTP aendern (is_club_admin) / Update a club SMTP config
   * Schreibt nur die uebergebenen Felder; fehlende behalten ihren Wert. Das Passwort ist WRITE-ONLY: senden ersetzt (leerer String loescht), weglassen behaelt das gespeicherte. Der Response maskiert es zu smtp_password_set. Erfordert is_club_admin.
   * 
   * `PATCH /clubs/{clubId}/smtp`
   */
  async patchClubsByClubIdSmtp(clubId: string, body: M.ClubSmtpUpdate, options?: RequestOptions): Promise<M.ClubSmtp> {
    return this.request<M.ClubSmtp>("PATCH", `/clubs/${encodeURIComponent(clubId)}/smtp`, { body, auth: true, options });
  }

  /**
   * Beitritt beantragen (Vereinscode) / Request to join a club (club code)
   * Ein RICHTIGER Code erzeugt einen ANTRAG (status=pending), keinen Zugang: app.member_role_keys (0025) filtert auf status=active, eine pending-Mitgliedschaft faellt damit durch jede Policy. Der Vorstand gibt frei (POST .../approve) - das wirkt sofort ohne Re-Login. Falscher/abgelaufener/widerrufener Code -> immer dieselbe 404 (keine Enumeration), zusaetzlich gedrosselt.
   * 
   * `POST /clubs/join`
   */
  async postClubsJoin(body: M.ClubJoinInput, options?: RequestOptions): Promise<M.ClubJoinResult> {
    return this.request<M.ClubJoinResult>("POST", "/clubs/join", { body, auth: true, options });
  }

  /**
   * Beitrittsantrag freigeben (pending -> active) / Approve a join request
   * Setzt status=active. Wirkt SOFORT ohne Re-Login (0025 loest Rollen bei jeder Anfrage aus der DB auf). Erfordert die Faehigkeit members>=manage. Der Trigger protect_club_membership (0007:216-222) blockt zusaetzlich jede Selbst-Freigabe.
   * 
   * `POST /clubs/{clubId}/members/{memberId}/approve`
   */
  async postClubsByClubIdMembersByMemberIdApprove(clubId: string, memberId: string, options?: RequestOptions): Promise<M.ClubMember> {
    return this.request<M.ClubMember>("POST", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/approve`, { auth: true, options });
  }

  /**
   * Beitrittsantrag ablehnen / Reject a join request
   * Setzt status=rejected und schreibt das Gedaechtnis fort (rejected_at, rejected_by, rejection_count). Die Zeile BLEIBT stehen - vorher war eine Ablehnung ein Soft-Delete, der den Vorgang verschwinden liess: der naechste Antrag derselben Person traf auf einen Vorstand ohne Gedaechtnis. Ein Wiederantrag ist nach einer Sperrfrist moeglich (POST /clubs/join dreht die Zeile zurueck auf pending); eine versehentliche Ablehnung nimmt POST .../approve sofort zurueck. Erfordert members>=manage.
   * 
   * `POST /clubs/{clubId}/members/{memberId}/reject`
   */
  async postClubsByClubIdMembersByMemberIdReject(clubId: string, memberId: string, options?: RequestOptions): Promise<M.ClubMember> {
    return this.request<M.ClubMember>("POST", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/reject`, { auth: true, options });
  }

  /**
   * Vereinscode neu erzeugen / Rotate the club join code
   * Erzeugt einen neuen Code (CSPRNG, Crockford-Base32). Mit overlap_hours bleibt der ALTE Code noch eine Weile gueltig - das war bis 0037 im Schema unmoeglich (der Code war eine SPALTE auf app.clubs, Rotieren hiess Ueberschreiben, der alte starb in derselben Sekunde). Genau deshalb rotierte niemand: ein Wechsel sperrte Aushang, WhatsApp-Gruppe und Anmeldeformular sofort aus. Ohne overlap_hours (Vorgabe) ist der alte Code sofort tot - das ist der richtige Weg bei einem GELEAKTEN Code. Erfordert owner/admin/moderator (wie clubs_update, 0007:253).
   * 
   * `POST /clubs/{clubId}/join-code/rotate`
   */
  async postClubsByClubIdJoinCodeRotate(clubId: string, body?: M.ClubJoinCodeRotateInput, options?: RequestOptions): Promise<M.ClubJoinCodeRotated> {
    return this.request<M.ClubJoinCodeRotated>("POST", `/clubs/${encodeURIComponent(clubId)}/join-code/rotate`, { body, auth: true, options });
  }

  /**
   * Vereinscode widerrufen / Revoke the club join code
   * Macht ALLE Codes des Vereins ungueltig, OHNE einen neuen zu erzeugen: der Verein nimmt damit keine Antraege mehr an. "Alle" ist woertlich - seit 0037 kann ein Verein mehrere Codes gleichzeitig fuehren (Ueberlappungsfenster einer Rotation), und ein Widerruf, der einen davon uebersieht, ist keiner. Getrennt von rotate, weil "niemand soll mehr beitreten" etwas anderes ist als "alle brauchen einen neuen Code".
   * 
   * `POST /clubs/{clubId}/join-code/revoke`
   */
  async postClubsByClubIdJoinCodeRevoke(clubId: string, options?: RequestOptions): Promise<M.ClubJoinCodeRevoked> {
    return this.request<M.ClubJoinCodeRevoked>("POST", `/clubs/${encodeURIComponent(clubId)}/join-code/revoke`, { auth: true, options });
  }

  /**
   * List the club roster (sensitive columns redacted for non-managers)
   * Jedes Vereinsmitglied sieht die Namensliste, das Foto (avatar_url) und das Selbst-Profil (profile_motto, profile_favorite_discipline, profile_skating_since) — letzteres pflegt die Person selbst und veroeffentlicht es damit bewusst im Verein. REDIGIER-Stufen: die Parent-KONTAKTdaten (birth_date, email, phone, postal_address) sehen can_manage_members (treasurer/moderator/admin/owner) + Plattform-Admins IMMER, und ein coach (NICHT guest_coach) ZEILENWEISE fuer Mitglieder seiner eigenen Teams (um deren Eltern zu erreichen); die Verwaltungs-Kontaktdaten (valid_until, profile_id) bleiben can_manage_members vorbehalten (nie dem coach); joined_on sieht zusaetzlich der coach ("Trainer und hoeher", ohne guest_coach). Redigierte Spalten bleiben als null im Ergebnis.
   * 
   * `GET /clubs/{clubId}/members`
   */
  async getClubsByClubIdMembers(clubId: string, options?: RequestOptions): Promise<M.ClubMember[]> {
    return this.request<M.ClubMember[]>("GET", `/clubs/${encodeURIComponent(clubId)}/members`, { auth: true, options });
  }

  /**
   * Create a membership row (can_manage_members)
   * Creates a person in the roster (e.g. a child without an account). owner/admin/moderator/treasurer may create; the assigned role is gated by can_change_member_role (treasurer may only create plain members, moderator only ranks below moderator). The owner role is never assignable here.
   * 
   * `POST /clubs/{clubId}/members`
   */
  async postClubsByClubIdMembers(clubId: string, body: M.ClubMemberCreate, options?: RequestOptions): Promise<M.ClubMember> {
    return this.request<M.ClubMember>("POST", `/clubs/${encodeURIComponent(clubId)}/members`, { body, auth: true, options });
  }

  /**
   * Einladung per E-Mail verschicken / Invite a person by e-mail (can_manage_members)
   * Legt eine Einladung an (nur der Token-HASH landet in der DB, Klartext nur in der Mail) und verschickt einen Annahme-Link. ENUMERATIONSSICHER: antwortet IMMER 202, egal ob die Adresse schon Mitglied ist, neu eingeladen oder eine offene Einladung aufgefrischt wurde. Empfaenger-gedrosselt (recipient-Achse). Ohne SMTP-Konfiguration bleibt die Einladung bestehen (resend-bar) und der Fehler wird sprechend geloggt statt zu crashen. Erfordert members:manage; die Zielrolle muss der Aufrufer vergeben duerfen (canAssignRole).
   * 
   * `POST /clubs/{clubId}/members/invite`
   */
  async postClubsByClubIdMembersInvite(clubId: string, body: M.ClubMemberInvite, options?: RequestOptions): Promise<M.InviteQueued> {
    return this.request<M.InviteQueued>("POST", `/clubs/${encodeURIComponent(clubId)}/members/invite`, { body, auth: true, options });
  }

  /**
   * List guardianships (family model) of a club
   * RLS-scoped: owner/admin see all relations, guardians/children only their own family rows.
   * 
   * `GET /clubs/{clubId}/guardianships`
   */
  async getClubsByClubIdGuardianships(clubId: string, options?: RequestOptions): Promise<M.Guardianship[]> {
    return this.request<M.Guardianship[]>("GET", `/clubs/${encodeURIComponent(clubId)}/guardianships`, { auth: true, options });
  }

  /**
   * Link an existing child to a guardian (self-service or admin)
   * Links an existing member as a child of a guardian. The guardian defaults to the CALLER'S own membership; a foreign guardian_member_id requires is_club_admin. Self-service is restricted to UNCLAIMED managed children (no login, no existing guardianship) so it can never claim an account or another family's child.
   * 
   * `POST /clubs/{clubId}/guardianships`
   */
  async postClubsByClubIdGuardianships(clubId: string, body: M.GuardianshipCreate, options?: RequestOptions): Promise<M.Guardianship> {
    return this.request<M.Guardianship>("POST", `/clubs/${encodeURIComponent(clubId)}/guardianships`, { body, auth: true, options });
  }

  /**
   * Edit member master data (can_manage_members; never the role)
   * Updates first/last name, e-mail, birth date, status and validity. The ROLE is deliberately not editable here - use PATCH .../members/{memberId}/role. can_manage_members = owner/admin/moderator/treasurer.
   * 
   * `PATCH /clubs/{clubId}/members/{memberId}`
   */
  async patchClubsByClubIdMembersByMemberId(clubId: string, memberId: string, body: M.ClubMemberUpdate, options?: RequestOptions): Promise<M.ClubMember> {
    return this.request<M.ClubMember>("PATCH", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a membership (can_manage_members; never the last active owner)
   * Setzt deleted_at auf der Mitgliedszeile (Soft-Delete/Tombstone, 0003) und loest die Team-Verknuepfungen, damit die Person aus den Team-Rostern verschwindet. can_manage_members (owner/admin/moderator/treasurer). SICHERHEIT: das LETZTE aktive owner-Mitglied ist nie loeschbar (sonst sperrt sich der Verein aus) -> 409.
   * 
   * `DELETE /clubs/{clubId}/members/{memberId}`
   */
  async deleteClubsByClubIdMembersByMemberId(clubId: string, memberId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}`, { auth: true, options });
  }

  /**
   * Change a member role (owner/admin; never self; last owner protected)
   * 
   * `PATCH /clubs/{clubId}/members/{memberId}/role`
   */
  async patchClubsByClubIdMembersByMemberIdRole(clubId: string, memberId: string, body: M.ClubMemberRoleChange, options?: RequestOptions): Promise<M.ClubMember> {
    return this.request<M.ClubMember>("PATCH", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/role`, { body, auth: true, options });
  }

  /**
   * Edit the SELF profile (own row or own child; never by managers)
   * Das Selbst-Profil pflegt die Person SELBST — bei Kindern ohne Konto ihre Erziehungsberechtigten (app.guardianships). Schreibrecht ist ausdruecklich KEIN Verwaltungsrecht: owner/admin/moderator koennen fremde Profile NICHT beschreiben (sie duerfen sie leeren — Moderation). Felder: motto (max. 140), favorite_discipline (max. 60), skating_since (Jahreszahl). Fehlender Schluessel = unveraendert, null oder "" = Angabe loeschen. Die Inhalte sind fuer ALLE aktiven Mitglieder des Vereins sichtbar — serverseitig werden hineinkopierte E-Mail-Adressen, Links und Telefonnummern am Stueck abgelehnt (422).
   * 
   * `PATCH /clubs/{clubId}/members/{memberId}/profile`
   */
  async patchClubsByClubIdMembersByMemberIdProfile(clubId: string, memberId: string, body: M.ClubMemberSelfProfileUpdate, options?: RequestOptions): Promise<M.ClubMember> {
    return this.request<M.ClubMember>("PATCH", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/profile`, { body, auth: true, options });
  }

  /**
   * Das 360-Grad-Profil EINER Person — jede Sektion rollen-gestaffelt und serverseitig
   * Sammelt Stammkopf, Selbst-Profil, Kontakt, Kueren, Wettkampf-Noten, Medaillen, Anwesenheit, Check-ins, Pflichtstunden, Termine (RSVP), Ausruestung, Finanzen, Trainer-Beurteilungen, Galerie-Fotos und die Konsent-Uebersicht EINER Person. Jede Sektion wird SERVERSEITIG nach den passenden Rechten gestaffelt: darf der/die Betrachter:in sie nicht sehen, kommt sie als null (nicht als leer/Fehler). Die Regel je Sektion steht im Schema. RLS traegt jede Zeile als zweite Linie; kein Service-Mode (der Endpunkt ist auf EINE Person begrenzt).
   * 
   * `GET /clubs/{clubId}/members/{memberId}/profile`
   */
  async getClubsByClubIdMembersByMemberIdProfile(clubId: string, memberId: string, options?: RequestOptions): Promise<M.MemberProfile> {
    return this.request<M.MemberProfile>("GET", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/profile`, { auth: true, options });
  }

  /**
   * Einladung ansehen (oeffentlich) / Look up an invitation (public)
   * Unauthentifiziert. Loest einen Einladungs-Token zu Vereinsname und Zielrolle auf — mehr nicht. Ein unbekannter, abgelaufener, widerrufener oder bereits angenommener Token liefert 404 (keine Auskunft, welcher Fall es war, kein Hinweis auf Mitgliedschaft).
   * 
   * `GET /public/invitations/{token}`
   */
  async getPublicInvitationsByToken(token: string, options?: RequestOptions): Promise<M.InvitationInfo> {
    return this.request<M.InvitationInfo>("GET", `/public/invitations/${encodeURIComponent(token)}`, { auth: false, options });
  }

  /**
   * Einladung annehmen / Accept an invitation
   * Erfordert Login. Legt token-geprueft (app.accept_invitation, SECURITY DEFINER) eine AKTIVE Mitgliedschaft fuer die angemeldete Person an und verbraucht den Token. Erfasst die Kenntnisnahme von Nutzungsbedingungen und Datenschutzerklaerung (Pflicht, alterslos — KEINE echte Einwilligung). Ein ungueltiger/abgelaufener/bereits benutzter Token liefert dieselbe 404 wie die oeffentliche Vorschau.
   * 
   * `POST /invitations/{token}/accept`
   */
  async postInvitationsByTokenAccept(token: string, body: M.InvitationAcceptInput, options?: RequestOptions): Promise<M.InvitationAcceptResult> {
    return this.request<M.InvitationAcceptResult>("POST", `/invitations/${encodeURIComponent(token)}/accept`, { body, auth: true, options });
  }

  /**
   * Create a child (no login) + guardianship (self-service or admin)
   * Creates a club_members row without a profile (a child) and links it to a guardian. The guardian defaults to the CALLER'S own membership (self-service - any member may add their own child); passing a foreign guardian_member_id requires is_club_admin.
   * 
   * `POST /clubs/{clubId}/children`
   */
  async postClubsByClubIdChildren(clubId: string, body: M.ChildCreate, options?: RequestOptions): Promise<M.ChildCreated> {
    return this.request<M.ChildCreated>("POST", `/clubs/${encodeURIComponent(clubId)}/children`, { body, auth: true, options });
  }

  /**
   * Remove a guardianship (its guardian, self-service, or admin)
   * 
   * `DELETE /clubs/{clubId}/guardianships/{guardianshipId}`
   */
  async deleteClubsByClubIdGuardianshipsByGuardianshipId(clubId: string, guardianshipId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/clubs/${encodeURIComponent(clubId)}/guardianships/${encodeURIComponent(guardianshipId)}`, { auth: true, options });
  }

  /**
   * Wirksamer Einwilligungsstand / Effective consent state
   * Liefert je (Person, Zweck) die WIRKSAME Einwilligung aus app.effective_consents — nicht das rohe Journal. state=revoked (Art. 7 Abs. 3) und state=expired_age_16 (die Erklärung einer erziehungsberechtigten Person erlischt mit dem 16. Geburtstag) sind beide effective=false. RLS entscheidet, wer was sieht: die betroffene Person, wer erklärt hat, und die Mitglieder-Verwaltung.
   * 
   * `GET /clubs/{clubId}/consents`
   */
  async getClubsByClubIdConsents(clubId: string, query?: { "member_id"?: string }, options?: RequestOptions): Promise<M.EffectiveConsent[]> {
    return this.request<M.EffectiveConsent[]>("GET", `/clubs/${encodeURIComponent(clubId)}/consents`, { query, auth: true, options });
  }

  /**
   * Einwilligung erteilen oder widerrufen / Grant or withdraw a consent
   * Erteilt (granted=true) oder widerruft (granted=false) eine Einwilligung für EINEN Zweck. Der Widerruf ist derselbe Aufruf mit granted=false — genauso einfach wie die Erteilung (Art. 7 Abs. 3 Satz 4) — und legt eine NEUE Zeile an; die frühere bleibt als Nachweis erhalten. Bei Minderjährigen erklärt eine erziehungsberechtigte Person (Art. 8); ab 16 nur noch die betroffene Person selbst. terms/privacy sind hier NICHT zulässig: das ist Kenntnisnahme, keine Einwilligung.
   * 
   * `POST /clubs/{clubId}/consents`
   */
  async postClubsByClubIdConsents(clubId: string, body: M.ConsentDeclare, options?: RequestOptions): Promise<M.EffectiveConsent> {
    return this.request<M.EffectiveConsent>("POST", `/clubs/${encodeURIComponent(clubId)}/consents`, { body, auth: true, options });
  }

  /**
   * List waitlist entries (own, or all when trainer+)
   * RLS-scoped: a plain member sees only their OWN entries; a trainer/admin sees the whole club queue. Optionally filtered by kind (facility/equipment/team/event).
   * 
   * `GET /waitlists`
   */
  async getWaitlists(query: { "club_id": string; "kind"?: M.WaitlistKind }, options?: RequestOptions): Promise<M.Waitlist[]> {
    return this.request<M.Waitlist[]>("GET", "/waitlists", { query, auth: true, options });
  }

  /**
   * Join a waitlist (self, or a trainer queuing anyone)
   * 
   * `POST /waitlists`
   */
  async postWaitlists(body: M.WaitlistCreate, options?: RequestOptions): Promise<M.Waitlist> {
    return this.request<M.Waitlist>("POST", "/waitlists", { body, auth: true, options });
  }

  /**
   * Update a waitlist entry (status/note) - creator or trainer
   * 
   * `PATCH /waitlists/{waitlistId}`
   */
  async patchWaitlistsByWaitlistId(waitlistId: string, body: M.WaitlistUpdate, options?: RequestOptions): Promise<M.Waitlist> {
    return this.request<M.Waitlist>("PATCH", `/waitlists/${encodeURIComponent(waitlistId)}`, { body, auth: true, options });
  }

  /**
   * Leave/remove a waitlist entry (creator or trainer)
   * 
   * `DELETE /waitlists/{waitlistId}`
   */
  async deleteWaitlistsByWaitlistId(waitlistId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/waitlists/${encodeURIComponent(waitlistId)}`, { auth: true, options });
  }

  /**
   * List budget plan rows for a club/year (can_manage_finance)
   * 
   * `GET /budgets`
   */
  async getBudgets(query: { "club_id": string; "year": number }, options?: RequestOptions): Promise<M.Budget[]> {
    return this.request<M.Budget[]>("GET", "/budgets", { query, auth: true, options });
  }

  /**
   * Create a budget plan row (can_manage_finance)
   * 
   * `POST /budgets`
   */
  async postBudgets(body: M.BudgetCreate, options?: RequestOptions): Promise<M.Budget> {
    return this.request<M.Budget>("POST", "/budgets", { body, auth: true, options });
  }

  /**
   * Edit a budget plan row (can_manage_finance)
   * 
   * `PATCH /budgets/{budgetId}`
   */
  async patchBudgetsByBudgetId(budgetId: string, body: M.BudgetUpdate, options?: RequestOptions): Promise<M.Budget> {
    return this.request<M.Budget>("PATCH", `/budgets/${encodeURIComponent(budgetId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a budget plan row (can_manage_finance)
   * 
   * `DELETE /budgets/{budgetId}`
   */
  async deleteBudgetsByBudgetId(budgetId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/budgets/${encodeURIComponent(budgetId)}`, { auth: true, options });
  }

  /**
   * Budget plan vs. actual per category (can_manage_finance)
   * 
   * `GET /reports/budget`
   */
  async getReportsBudget(query: { "club_id": string; "year": number }, options?: RequestOptions): Promise<M.BudgetReport> {
    return this.request<M.BudgetReport>("GET", "/reports/budget", { query, auth: true, options });
  }

  /**
   * The logged-in user: profile + their own club memberships
   * 
   * `GET /me`
   */
  async getMe(options?: RequestOptions): Promise<M.Me> {
    return this.request<M.Me>("GET", "/me", { auth: true, options });
  }

  /**
   * Edit the caller's OWN master data (never role/status)
   * Updates first/last name, e-mail and birth date on the caller's own membership row(s). member_id = self is enforced server-side (WHERE profile_id = auth.uid()); a member may do this without can_manage_members. Role, status and validity are deliberately NOT editable here - the protect_club_membership trigger rejects any self-change to them.
   * 
   * `PATCH /me`
   */
  async patchMe(body: M.MeUpdate, options?: RequestOptions): Promise<M.Me> {
    return this.request<M.Me>("PATCH", "/me", { body, auth: true, options });
  }

  /**
   * The caller's app-shell preferences (locale/theme/notifications)
   * 
   * `GET /me/preferences`
   */
  async getMePreferences(options?: RequestOptions): Promise<M.UserPreferences> {
    return this.request<M.UserPreferences>("GET", "/me/preferences", { auth: true, options });
  }

  /**
   * Upsert the caller's preferences (notifications deep-merged)
   * 
   * `PATCH /me/preferences`
   */
  async patchMePreferences(body: M.UserPreferencesUpdate, options?: RequestOptions): Promise<M.UserPreferences> {
    return this.request<M.UserPreferences>("PATCH", "/me/preferences", { body, auth: true, options });
  }

  /**
   * Die aufgeloesten Rechte der eingeloggten Person in einem Verein
   * Loest die Rechte SERVERSEITIG aus der Datenbank auf (app.cap_ranks): Mehrfachrollen werden vereinigt (hoechste Stufe je Faehigkeit gewinnt) und Aenderungen wirken sofort, ohne neuen Token. Liefert den vollstaendigen Faehigkeiten-Katalog inkl. bilingualer Labels und der im Admin waehlbaren Stufen — auch dort, wo der Rang 0 ist. HINWEIS fuer Clients: was eine Stufe WIRKLICH bewirkt, steht je Faehigkeit in `enforcement` (0033) — nur bei "enforced" entzieht die Stufe "none" auch den LESEZUGRIFF. Bei "partial" (finance, member_contact) wirkt sie nur auf einen Teil des Lesens, bei "write_only" nur auf das Schreiben, bei "unenforced" auf nichts. "none" darf deshalb NICHT pauschal als "abgeschaltet" beschriftet werden — das waere eine Zusage, die der Server nicht einloest.
   * 
   * `GET /me/capabilities`
   */
  async getMeCapabilities(query: { "club_id": string }, options?: RequestOptions): Promise<M.CapabilityResolution> {
    return this.request<M.CapabilityResolution>("GET", "/me/capabilities", { query, auth: true, options });
  }

  /**
   * Der globale Faehigkeiten-Katalog (bilingual, mit waehlbaren Stufen)
   * 
   * `GET /capabilities`
   */
  async getCapabilities(options?: RequestOptions): Promise<M.Capability[]> {
    return this.request<M.Capability[]>("GET", "/capabilities", { auth: true, options });
  }

  /**
   * Die Rollen ALLER Mitglieder des Vereins (Mehrfachrollen, Leseseite)
   * Eine Zeile je Person mit mindestens einer Rollenzuweisung. Gegenstueck zu PUT /clubs/{clubId}/members/{memberId}/roles.
   * 
   * `GET /clubs/{clubId}/member-roles`
   */
  async getClubsByClubIdMemberRoles(clubId: string, options?: RequestOptions): Promise<M.MemberRoleAssignment[]> {
    return this.request<M.MemberRoleAssignment[]>("GET", `/clubs/${encodeURIComponent(clubId)}/member-roles`, { auth: true, options });
  }

  /**
   * Die Rollen des Vereins (Systemrollen + eigene)
   * 
   * `GET /clubs/{clubId}/roles`
   */
  async getClubsByClubIdRoles(clubId: string, options?: RequestOptions): Promise<M.ClubRoleDef[]> {
    return this.request<M.ClubRoleDef[]>("GET", `/clubs/${encodeURIComponent(clubId)}/roles`, { auth: true, options });
  }

  /**
   * Eine eigene Rolle anlegen (startet ohne Rechte)
   * Legt eine Vereins-eigene Rolle an. Sie beginnt ohne jede Berechtigung (fail-closed); die Stufen werden anschliessend per PUT /clubs/{clubId}/roles/{roleId}/permissions gesetzt. Systemrollen lassen sich hierueber nicht erzeugen.
   * 
   * `POST /clubs/{clubId}/roles`
   */
  async postClubsByClubIdRoles(clubId: string, body: M.ClubRoleDefCreate, options?: RequestOptions): Promise<M.ClubRoleDef> {
    return this.request<M.ClubRoleDef>("POST", `/clubs/${encodeURIComponent(clubId)}/roles`, { body, auth: true, options });
  }

  /**
   * Die Rechte-Matrix einer Rolle
   * 
   * `GET /clubs/{clubId}/roles/{roleId}/permissions`
   */
  async getClubsByClubIdRolesByRoleIdPermissions(clubId: string, roleId: string, options?: RequestOptions): Promise<M.RolePermission[]> {
    return this.request<M.RolePermission[]>("GET", `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}/permissions`, { auth: true, options });
  }

  /**
   * Die Rechte-Matrix einer Rolle setzen
   * Setzt die uebergebenen Faehigkeiten auf die genannten Stufen (Teilmenge erlaubt; nicht genannte Faehigkeiten bleiben unveraendert). Die owner-Rolle ist geschuetzt und kann nicht abgesenkt werden. Wirkt SOFORT — auch fuer bereits angemeldete Personen.
   * 
   * `PUT /clubs/{clubId}/roles/{roleId}/permissions`
   */
  async putClubsByClubIdRolesByRoleIdPermissions(clubId: string, roleId: string, body: M.RolePermissionSet, options?: RequestOptions): Promise<M.RolePermission[]> {
    return this.request<M.RolePermission[]>("PUT", `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}/permissions`, { body, auth: true, options });
  }

  /**
   * Eine Rolle umbenennen oder umsortieren
   * 
   * `PATCH /clubs/{clubId}/roles/{roleId}`
   */
  async patchClubsByClubIdRolesByRoleId(clubId: string, roleId: string, body: M.ClubRoleDefUpdate, options?: RequestOptions): Promise<M.ClubRoleDef> {
    return this.request<M.ClubRoleDef>("PATCH", `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}`, { body, auth: true, options });
  }

  /**
   * Eine eigene Rolle loeschen (Systemrollen sind geschuetzt)
   * 
   * `DELETE /clubs/{clubId}/roles/{roleId}`
   */
  async deleteClubsByClubIdRolesByRoleId(clubId: string, roleId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}`, { auth: true, options });
  }

  /**
   * Die Rollen einer Person setzen (mehrere moeglich)
   * Setzt den Zielzustand der Rollenzuweisungen. Rechte = Vereinigung ueber alle Rollen (hoechste Stufe je Faehigkeit gewinnt). Wirkt SOFORT, ohne dass sich die Person neu anmelden muss. Nur die tatsaechlichen Aenderungen werden geschrieben.
   * 
   * `PUT /clubs/{clubId}/members/{memberId}/roles`
   */
  async putClubsByClubIdMembersByMemberIdRoles(clubId: string, memberId: string, body: M.MemberRolesSet, options?: RequestOptions): Promise<M.ClubRoleDef[]> {
    return this.request<M.ClubRoleDef[]>("PUT", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/roles`, { body, auth: true, options });
  }

  /**
   * Die Trainer:innen eines Teams setzen
   * Setzt den Zielzustand der Trainer-Zuordnungen eines Teams (n:m — eine Person kann mehrere Teams betreuen). Entfernte Zuordnungen werden soft-geloescht. Wer im Team bereits Skater ist, kann nicht zusaetzlich Trainer:in sein (eine Zeile je Person und Team).
   * 
   * `PUT /clubs/{clubId}/teams/{teamId}/coaches`
   */
  async putClubsByClubIdTeamsByTeamIdCoaches(clubId: string, teamId: string, body: M.TeamCoachesSet, options?: RequestOptions): Promise<string[]> {
    return this.request<string[]>("PUT", `/clubs/${encodeURIComponent(clubId)}/teams/${encodeURIComponent(teamId)}/coaches`, { body, auth: true, options });
  }

  /**
   * Modul-Katalog + Schalterstellung des Vereins (is_club_member)
   * 
   * `GET /clubs/{clubId}/modules`
   */
  async getClubsByClubIdModules(clubId: string, options?: RequestOptions): Promise<M.ClubModuleState[]> {
    return this.request<M.ClubModuleState[]>("GET", `/clubs/${encodeURIComponent(clubId)}/modules`, { auth: true, options });
  }

  /**
   * Modul ein-/ausschalten (is_club_admin; Kernmodule sind gesperrt)
   * 
   * `PUT /clubs/{clubId}/modules/{moduleKey}`
   */
  async putClubsByClubIdModulesByModuleKey(clubId: string, moduleKey: string, body: M.ClubModuleSet, options?: RequestOptions): Promise<M.ClubModuleState> {
    return this.request<M.ClubModuleState>("PUT", `/clubs/${encodeURIComponent(clubId)}/modules/${encodeURIComponent(moduleKey)}`, { body, auth: true, options });
  }

  /**
   * Die Module, die DIESE Person im Menue sehen soll (is_club_member)
   * Katalog + Vereins-Schalter + PRO + aufgeloeste Sichtbarkeit (Mitglied > Gruppe > Rolle > Vorgabe) fuer die aufrufende Person. NUR ein Menue — kein Zugriffsrecht: ein hier fehlendes Modul bleibt ueber einen Deeplink genauso erreichbar bzw. gesperrt wie vorher.
   * 
   * `GET /clubs/{clubId}/modules/effective`
   */
  async getClubsByClubIdModulesEffective(clubId: string, options?: RequestOptions): Promise<M.EffectiveModule[]> {
    return this.request<M.EffectiveModule[]>("GET", `/clubs/${encodeURIComponent(clubId)}/modules/effective`, { auth: true, options });
  }

  /**
   * Sichtbarkeits-Matrix des Vereins (is_club_member)
   * 
   * `GET /clubs/{clubId}/modules/visibility`
   */
  async getClubsByClubIdModulesVisibility(clubId: string, options?: RequestOptions): Promise<M.ModuleVisibilityRow[]> {
    return this.request<M.ModuleVisibilityRow[]>("GET", `/clubs/${encodeURIComponent(clubId)}/modules/visibility`, { auth: true, options });
  }

  /**
   * Modul fuer Rolle/Gruppe/Mitglied ein- oder ausblenden (is_club_admin)
   * Setzt eine Ausnahme von der abgeleiteten Vorgabe. visible: null nimmt die Ausnahme zurueck. NUR das Menue — es wird dadurch kein Zugriff gewaehrt und keiner entzogen.
   * 
   * `PUT /clubs/{clubId}/modules/{moduleKey}/visibility`
   */
  async putClubsByClubIdModulesByModuleKeyVisibility(clubId: string, moduleKey: string, body: M.ModuleVisibilitySet, options?: RequestOptions): Promise<M.ModuleVisibilityRow[]> {
    return this.request<M.ModuleVisibilityRow[]>("PUT", `/clubs/${encodeURIComponent(clubId)}/modules/${encodeURIComponent(moduleKey)}/visibility`, { body, auth: true, options });
  }

  /**
   * List teams of a club incl. skater/coach member ids
   * 
   * `GET /clubs/{clubId}/teams`
   */
  async getClubsByClubIdTeams(clubId: string, options?: RequestOptions): Promise<M.Team[]> {
    return this.request<M.Team[]>("GET", `/clubs/${encodeURIComponent(clubId)}/teams`, { auth: true, options });
  }

  /**
   * Create a team (is_club_admin)
   * 
   * `POST /clubs/{clubId}/teams`
   */
  async postClubsByClubIdTeams(clubId: string, body: M.TeamCreate, options?: RequestOptions): Promise<M.Team> {
    return this.request<M.Team>("POST", `/clubs/${encodeURIComponent(clubId)}/teams`, { body, auth: true, options });
  }

  /**
   * Rename a team / change age group (is_club_admin)
   * 
   * `PATCH /clubs/{clubId}/teams/{teamId}`
   */
  async patchClubsByClubIdTeamsByTeamId(clubId: string, teamId: string, body: M.TeamUpdate, options?: RequestOptions): Promise<M.Team> {
    return this.request<M.Team>("PATCH", `/clubs/${encodeURIComponent(clubId)}/teams/${encodeURIComponent(teamId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a team (is_club_admin)
   * 
   * `DELETE /clubs/{clubId}/teams/{teamId}`
   */
  async deleteClubsByClubIdTeamsByTeamId(clubId: string, teamId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/clubs/${encodeURIComponent(clubId)}/teams/${encodeURIComponent(teamId)}`, { auth: true, options });
  }

  /**
   * Replace a team roster: skaters + coaches (is_club_admin)
   * Full replace. Member ids must belong to the club. A member may hold exactly one role per team (coach wins on overlap). Missing members are soft-detached.
   * 
   * `PUT /clubs/{clubId}/teams/{teamId}/members`
   */
  async putClubsByClubIdTeamsByTeamIdMembers(clubId: string, teamId: string, body: M.TeamMembersSet, options?: RequestOptions): Promise<M.Team> {
    return this.request<M.Team>("PUT", `/clubs/${encodeURIComponent(clubId)}/teams/${encodeURIComponent(teamId)}/members`, { body, auth: true, options });
  }

  /**
   * List sparten of a club incl. member ids (is_club_member)
   * 
   * `GET /clubs/{clubId}/sparten`
   */
  async getClubsByClubIdSparten(clubId: string, options?: RequestOptions): Promise<M.Sparte[]> {
    return this.request<M.Sparte[]>("GET", `/clubs/${encodeURIComponent(clubId)}/sparten`, { auth: true, options });
  }

  /**
   * Create a sparte (can_manage_sparten: owner/admin/treasurer)
   * 
   * `POST /clubs/{clubId}/sparten`
   */
  async postClubsByClubIdSparten(clubId: string, body: M.SparteCreate, options?: RequestOptions): Promise<M.Sparte> {
    return this.request<M.Sparte>("POST", `/clubs/${encodeURIComponent(clubId)}/sparten`, { body, auth: true, options });
  }

  /**
   * Edit / (de)activate a sparte (can_manage_sparten)
   * 
   * `PATCH /clubs/{clubId}/sparten/{sparteId}`
   */
  async patchClubsByClubIdSpartenBySparteId(clubId: string, sparteId: string, body: M.SparteUpdate, options?: RequestOptions): Promise<M.Sparte> {
    return this.request<M.Sparte>("PATCH", `/clubs/${encodeURIComponent(clubId)}/sparten/${encodeURIComponent(sparteId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a sparte (can_manage_sparten)
   * 
   * `DELETE /clubs/{clubId}/sparten/{sparteId}`
   */
  async deleteClubsByClubIdSpartenBySparteId(clubId: string, sparteId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/clubs/${encodeURIComponent(clubId)}/sparten/${encodeURIComponent(sparteId)}`, { auth: true, options });
  }

  /**
   * Replace a sparte roster (can_manage_sparten)
   * Full replace. Member ids must belong to the sparte's club. Missing members are soft-detached; previously removed members are revived. Assigning/removing is can_manage_sparten only.
   * 
   * `PUT /clubs/{clubId}/sparten/{sparteId}/members`
   */
  async putClubsByClubIdSpartenBySparteIdMembers(clubId: string, sparteId: string, body: M.SparteMembersSet, options?: RequestOptions): Promise<M.Sparte> {
    return this.request<M.Sparte>("PUT", `/clubs/${encodeURIComponent(clubId)}/sparten/${encodeURIComponent(sparteId)}/members`, { body, auth: true, options });
  }

  /**
   * Assign a team to a sparte (or clear it) (can_manage_sparten)
   * 
   * `PUT /clubs/{clubId}/teams/{teamId}/sparte`
   */
  async putClubsByClubIdTeamsByTeamIdSparte(clubId: string, teamId: string, body: M.TeamSparteSet, options?: RequestOptions): Promise<M.Team> {
    return this.request<M.Team>("PUT", `/clubs/${encodeURIComponent(clubId)}/teams/${encodeURIComponent(teamId)}/sparte`, { body, auth: true, options });
  }

  /**
   * All clubs incl. member count (platform admin only)
   * 
   * `GET /platform/clubs`
   */
  async getPlatformClubs(options?: RequestOptions): Promise<M.PlatformClub[]> {
    return this.request<M.PlatformClub[]>("GET", "/platform/clubs", { auth: true, options });
  }

  /**
   * All user profiles incl. club count (platform admin only)
   * 
   * `GET /platform/users`
   */
  async getPlatformUsers(options?: RequestOptions): Promise<M.PlatformUser[]> {
    return this.request<M.PlatformUser[]>("GET", "/platform/users", { auth: true, options });
  }

  /**
   * Platform key figures (platform admin only)
   * 
   * `GET /platform/stats`
   */
  async getPlatformStats(options?: RequestOptions): Promise<M.PlatformStats> {
    return this.request<M.PlatformStats>("GET", "/platform/stats", { auth: true, options });
  }

  /**
   * Platform settings incl. SMTP (password masked) (platform admin only)
   * 
   * `GET /platform/settings`
   */
  async getPlatformSettings(options?: RequestOptions): Promise<M.PlatformSettings> {
    return this.request<M.PlatformSettings>("GET", "/platform/settings", { auth: true, options });
  }

  /**
   * Update platform settings (SMTP/legal/content/flags) (platform admin only)
   * Deep-merges the given sections into the singleton settings row. The SMTP password is write-only: send it to set/replace it, omit it to keep the stored one. The response masks it to password_set.
   * 
   * `PATCH /platform/settings`
   */
  async patchPlatformSettings(body: M.PlatformSettingsPatch, options?: RequestOptions): Promise<M.PlatformSettings> {
    return this.request<M.PlatformSettings>("PATCH", "/platform/settings", { body, auth: true, options });
  }

  /**
   * Send a test email to verify SMTP (platform admin only)
   * Sends a small bilingual test mail to the given address so the operator can confirm SMTP works, without triggering a real user flow. dry_run=true only renders the mail and returns it. Rate-limited on the recipient (and account/IP) axis. Always answers 200 with ok:true|false and an honest reason.
   * 
   * `POST /platform/settings/smtp-test`
   */
  async postPlatformSettingsSmtpTest(body: M.SmtpTestRequest, options?: RequestOptions): Promise<M.SmtpTestResponse> {
    return this.request<M.SmtpTestResponse>("POST", "/platform/settings/smtp-test", { body, auth: true, options });
  }

  /**
   * All clubs incl. license tier/status/term (platform admin only)
   * 
   * `GET /platform/entitlements`
   */
  async getPlatformEntitlements(options?: RequestOptions): Promise<M.PlatformEntitlementRow[]> {
    return this.request<M.PlatformEntitlementRow[]>("GET", "/platform/entitlements", { auth: true, options });
  }

  /**
   * Set a club license tier/status/term by hand (platform admin only)
   * Writes the club_license entitlement through the single billing writer (state machine + audit). source=manual, actor=platform:<sub>. trial_days is a convenience for status='trial' (term = now + N days).
   * 
   * `PATCH /platform/entitlements/{clubId}`
   */
  async patchPlatformEntitlementsByClubId(clubId: string, body: M.PlatformEntitlementPatch, options?: RequestOptions): Promise<M.PlatformEntitlementRow> {
    return this.request<M.PlatformEntitlementRow>("PATCH", `/platform/entitlements/${encodeURIComponent(clubId)}`, { body, auth: true, options });
  }

  /**
   * Payment webhook events + subscription states, paginated (platform admin only)
   * 
   * `GET /platform/payments`
   */
  async getPlatformPayments(query?: { "provider"?: "stripe" | "revenuecat"; "status"?: "received" | "processed" | "failed" | "skipped"; "limit"?: number; "offset"?: number | null }, options?: RequestOptions): Promise<M.PlatformPayments> {
    return this.request<M.PlatformPayments>("GET", "/platform/payments", { query, auth: true, options });
  }

  /**
   * Full product catalog incl. inactive (platform admin only)
   * 
   * `GET /platform/products`
   */
  async getPlatformProducts(options?: RequestOptions): Promise<M.PlatformProduct[]> {
    return this.request<M.PlatformProduct[]>("GET", "/platform/products", { auth: true, options });
  }

  /**
   * Update a product price / active flag (platform admin only)
   * 
   * `PATCH /platform/products/{id}`
   */
  async patchPlatformProductsById(id: string, body: M.PlatformProductPatch, options?: RequestOptions): Promise<M.PlatformProduct> {
    return this.request<M.PlatformProduct>("PATCH", `/platform/products/${encodeURIComponent(id)}`, { body, auth: true, options });
  }

  /**
   * All routines across all clubs, for moderation (platform admin only)
   * Cross-club routine list for content moderation (music/title review). Optional filters: club_id, status, free text q over title/music_title/music_artist. Skater names are deliberately NOT returned — see PlatformRoutineRow.
   * 
   * `GET /platform/routines`
   */
  async getPlatformRoutines(query?: { "club_id"?: string; "status"?: "draft" | "ready" | "competition" | "archived"; "q"?: string; "limit"?: number; "offset"?: number | null }, options?: RequestOptions): Promise<M.PlatformRoutineRow[]> {
    return this.request<M.PlatformRoutineRow[]>("GET", "/platform/routines", { query, auth: true, options });
  }

  /**
   * System health: version, DB figures, migrations, health (platform admin only)
   * 
   * `GET /platform/system`
   */
  async getPlatformSystem(options?: RequestOptions): Promise<M.PlatformSystem> {
    return this.request<M.PlatformSystem>("GET", "/platform/system", { auth: true, options });
  }

  /**
   * List events of a club (optionally time-windowed)
   * 
   * `GET /events`
   */
  async getEvents(query: { "club_id": string; "from"?: string; "to"?: string }, options?: RequestOptions): Promise<M.Event[]> {
    return this.request<M.Event[]>("GET", "/events", { query, auth: true, options });
  }

  /**
   * Create an event (owner/admin/coach) with optional team links
   * 
   * `POST /events`
   */
  async postEvents(body: M.EventCreate, options?: RequestOptions): Promise<M.Event> {
    return this.request<M.Event>("POST", "/events", { body, auth: true, options });
  }

  /**
   * Edit an event (owner/admin/coach); team links only for coached teams
   * 
   * `PATCH /events/{eventId}`
   */
  async patchEventsByEventId(eventId: string, body: M.EventUpdate, options?: RequestOptions): Promise<M.Event> {
    return this.request<M.Event>("PATCH", `/events/${encodeURIComponent(eventId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete an event (owner/admin/coach; club-wide events only by the board)
   * 
   * `DELETE /events/{eventId}`
   */
  async deleteEventsByEventId(eventId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/events/${encodeURIComponent(eventId)}`, { auth: true, options });
  }

  /**
   * Set an RSVP for the own membership or an own child (guardianship)
   * Upsert on (event, member). RLS enforces can_act_for_member: own row or own child - coaches may answer for anyone in the club.
   * 
   * `PUT /events/{eventId}/rsvp`
   */
  async putEventsByEventIdRsvp(eventId: string, body: M.EventRsvpUpsert, options?: RequestOptions): Promise<M.EventRsvp> {
    return this.request<M.EventRsvp>("PUT", `/events/${encodeURIComponent(eventId)}/rsvp`, { body, auth: true, options });
  }

  /**
   * List attendance records of a club (optionally for one event)
   * 
   * `GET /attendance`
   */
  async getAttendance(query: { "club_id": string; "event_id"?: string }, options?: RequestOptions): Promise<M.Attendance[]> {
    return this.request<M.Attendance[]>("GET", "/attendance", { query, auth: true, options });
  }

  /**
   * Record attendance for a member (coach and above, incl. guest_coach)
   * 
   * `PUT /events/{eventId}/attendance`
   */
  async putEventsByEventIdAttendance(eventId: string, body: M.AttendanceUpsert, options?: RequestOptions): Promise<M.Attendance> {
    return this.request<M.Attendance>("PUT", `/events/${encodeURIComponent(eventId)}/attendance`, { body, auth: true, options });
  }

  /**
   * Fahrgemeinschaften eines Termins (Sichtbarkeit = Termin-Sichtbarkeit)
   * 
   * `GET /events/{eventId}/rides`
   */
  async getEventsByEventIdRides(eventId: string, options?: RequestOptions): Promise<M.EventRide[]> {
    return this.request<M.EventRide[]>("GET", `/events/${encodeURIComponent(eventId)}/rides`, { auth: true, options });
  }

  /**
   * Fahrt anbieten (aktives Mitglied, nicht minderjaehrig)
   * 
   * `POST /events/{eventId}/rides`
   */
  async postEventsByEventIdRides(eventId: string, body: M.EventRideCreate, options?: RequestOptions): Promise<M.EventRide> {
    return this.request<M.EventRide>("POST", `/events/${encodeURIComponent(eventId)}/rides`, { body, auth: true, options });
  }

  /**
   * Fahrt bearbeiten oder absagen (Fahrer:in oder Vorstand)
   * 
   * `PATCH /rides/{rideId}`
   */
  async patchRidesByRideId(rideId: string, body: M.EventRideUpdate, options?: RequestOptions): Promise<M.EventRide> {
    return this.request<M.EventRide>("PATCH", `/rides/${encodeURIComponent(rideId)}`, { body, auth: true, options });
  }

  /**
   * Als Mitfahrer:in zusagen (fuer sich selbst oder das eigene Kind)
   * 
   * `POST /rides/{rideId}/riders`
   */
  async postRidesByRideIdRiders(rideId: string, body: M.EventRideRiderCreate, options?: RequestOptions): Promise<M.EventRide> {
    return this.request<M.EventRide>("POST", `/rides/${encodeURIComponent(rideId)}/riders`, { body, auth: true, options });
  }

  /**
   * Zusage zurueckziehen oder erneuern
   * 
   * `PATCH /rides/{rideId}/riders/{riderId}`
   */
  async patchRidesByRideIdRidersByRiderId(rideId: string, riderId: string, body: M.EventRideRiderUpdate, options?: RequestOptions): Promise<M.EventRide> {
    return this.request<M.EventRide>("PATCH", `/rides/${encodeURIComponent(rideId)}/riders/${encodeURIComponent(riderId)}`, { body, auth: true, options });
  }

  /**
   * List routines of a club
   * 
   * `GET /routines`
   */
  async getRoutines(query: { "club_id": string }, options?: RequestOptions): Promise<M.Routine[]> {
    return this.request<M.Routine[]>("GET", "/routines", { query, auth: true, options });
  }

  /**
   * Create a routine (coaching staff incl. guest_coach)
   * 
   * `POST /routines`
   */
  async postRoutines(body: M.RoutineCreate, options?: RequestOptions): Promise<M.Routine> {
    return this.request<M.Routine>("POST", "/routines", { body, auth: true, options });
  }

  /**
   * Get a routine
   * 
   * `GET /routines/{routineId}`
   */
  async getRoutinesByRoutineId(routineId: string, options?: RequestOptions): Promise<M.Routine> {
    return this.request<M.Routine>("GET", `/routines/${encodeURIComponent(routineId)}`, { auth: true, options });
  }

  /**
   * List time markers of a routine
   * 
   * `GET /routines/{routineId}/markers`
   */
  async getRoutinesByRoutineIdMarkers(routineId: string, options?: RequestOptions): Promise<M.RoutineMarker[]> {
    return this.request<M.RoutineMarker[]>("GET", `/routines/${encodeURIComponent(routineId)}/markers`, { auth: true, options });
  }

  /**
   * Add a time marker (coaching staff incl. guest_coach)
   * 
   * `POST /routines/{routineId}/markers`
   */
  async postRoutinesByRoutineIdMarkers(routineId: string, body: M.RoutineMarkerCreate, options?: RequestOptions): Promise<M.RoutineMarker> {
    return this.request<M.RoutineMarker>("POST", `/routines/${encodeURIComponent(routineId)}/markers`, { body, auth: true, options });
  }

  /**
   * Score history of a routine
   * 
   * `GET /routines/{routineId}/scores`
   */
  async getRoutinesByRoutineIdScores(routineId: string, options?: RequestOptions): Promise<M.RoutineScore[]> {
    return this.request<M.RoutineScore[]>("GET", `/routines/${encodeURIComponent(routineId)}/scores`, { auth: true, options });
  }

  /**
   * Record a score (coaching staff incl. guest_coach)
   * 
   * `POST /routines/{routineId}/scores`
   */
  async postRoutinesByRoutineIdScores(routineId: string, body: M.RoutineScoreCreate, options?: RequestOptions): Promise<M.RoutineScore> {
    return this.request<M.RoutineScore>("POST", `/routines/${encodeURIComponent(routineId)}/scores`, { body, auth: true, options });
  }

  /**
   * Create a public share link for a routine (coaching staff)
   * 
   * `POST /routines/{routineId}/share`
   */
  async postRoutinesByRoutineIdShare(routineId: string, body: M.RoutineShareCreate, options?: RequestOptions): Promise<M.RoutineShareCreated> {
    return this.request<M.RoutineShareCreated>("POST", `/routines/${encodeURIComponent(routineId)}/share`, { body, auth: true, options });
  }

  /**
   * Revoke a share link (coaching staff)
   * 
   * `DELETE /routines/{routineId}/share/{token}`
   */
  async deleteRoutinesByRoutineIdShareByToken(routineId: string, token: string, options?: RequestOptions): Promise<M.RoutineShareRevoked> {
    return this.request<M.RoutineShareRevoked>("DELETE", `/routines/${encodeURIComponent(routineId)}/share/${encodeURIComponent(token)}`, { auth: true, options });
  }

  /**
   * List competitions of a club incl. entries (start list)
   * 
   * `GET /competitions`
   */
  async getCompetitions(query: { "club_id": string }, options?: RequestOptions): Promise<M.Competition[]> {
    return this.request<M.Competition[]>("GET", "/competitions", { query, auth: true, options });
  }

  /**
   * Create a competition (owner/admin/moderator/coach)
   * 
   * `POST /competitions`
   */
  async postCompetitions(body: M.CompetitionCreate, options?: RequestOptions): Promise<M.Competition> {
    return this.request<M.Competition>("POST", "/competitions", { body, auth: true, options });
  }

  /**
   * Edit a competition (owner/admin/moderator/coach)
   * 
   * `PATCH /competitions/{competitionId}`
   */
  async patchCompetitionsByCompetitionId(competitionId: string, body: M.CompetitionUpdate, options?: RequestOptions): Promise<M.Competition> {
    return this.request<M.Competition>("PATCH", `/competitions/${encodeURIComponent(competitionId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a competition (owner/admin/moderator/coach)
   * 
   * `DELETE /competitions/{competitionId}`
   */
  async deleteCompetitionsByCompetitionId(competitionId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/competitions/${encodeURIComponent(competitionId)}`, { auth: true, options });
  }

  /**
   * Ranked standings of a competition (per category)
   * 
   * `GET /competitions/{competitionId}/standings`
   */
  async getCompetitionsByCompetitionIdStandings(competitionId: string, options?: RequestOptions): Promise<M.CompetitionStandings> {
    return this.request<M.CompetitionStandings>("GET", `/competitions/${encodeURIComponent(competitionId)}/standings`, { auth: true, options });
  }

  /**
   * Public, login-free view of a shared Kür (opaque token)
   * Unauthenticated. Resolves a share token to the minimal, non-personal Kür payload. A revoked, expired or unknown token returns 404. No skater identities, no finance.
   * 
   * `GET /public/routines/{token}`
   */
  async getPublicRoutinesByToken(token: string, options?: RequestOptions): Promise<M.PublicRoutine> {
    return this.request<M.PublicRoutine>("GET", `/public/routines/${encodeURIComponent(token)}`, { auth: false, options });
  }

  /**
   * Public, login-free legal texts (imprint, privacy, terms)
   * Unauthenticated. Returns ONLY the operator-maintained legal override texts (imprint, privacy policy, terms) in German and English. An empty value means the public page shows its built-in default. No other operator settings are exposed.
   * 
   * `GET /public/legal`
   */
  async getPublicLegal(options?: RequestOptions): Promise<M.PublicLegal> {
    return this.request<M.PublicLegal>("GET", "/public/legal", { auth: false, options });
  }

  /**
   * Email/password login — issues an access token
   * Unauthenticated. Verifies email + password and returns a signed access token with the same claims as the dev persona login. Unknown email and wrong password are indistinguishable.
   * 
   * `POST /auth/login`
   */
  async postAuthLogin(body: M.LoginRequest, options?: RequestOptions): Promise<M.LoginResponse> {
    return this.request<M.LoginResponse>("POST", "/auth/login", { body, auth: false, options });
  }

  /**
   * List tasks of a club (open first, then by due date)
   * 
   * `GET /tasks`
   */
  async getTasks(query: { "club_id": string }, options?: RequestOptions): Promise<M.Task[]> {
    return this.request<M.Task[]>("GET", "/tasks", { query, auth: true, options });
  }

  /**
   * Tick a task off / reopen it (staff or assignee)
   * 
   * `PATCH /tasks/{taskId}`
   */
  async patchTasksByTaskId(taskId: string, body: M.TaskUpdate, options?: RequestOptions): Promise<M.Task> {
    return this.request<M.Task>("PATCH", `/tasks/${encodeURIComponent(taskId)}`, { body, auth: true, options });
  }

  /**
   * List club news (pinned first, then newest published)
   * 
   * `GET /news`
   */
  async getNews(query: { "club_id": string }, options?: RequestOptions): Promise<M.News[]> {
    return this.request<M.News[]>("GET", "/news", { query, auth: true, options });
  }

  /**
   * Create a news item (coaching staff, is_club_trainer)
   * 
   * `POST /news`
   */
  async postNews(body: M.NewsCreate, options?: RequestOptions): Promise<M.News> {
    return this.request<M.News>("POST", "/news", { body, auth: true, options });
  }

  /**
   * Edit a news item (coaching staff, is_club_trainer)
   * 
   * `PATCH /news/{newsId}`
   */
  async patchNewsByNewsId(newsId: string, body: M.NewsUpdate, options?: RequestOptions): Promise<M.News> {
    return this.request<M.News>("PATCH", `/news/${encodeURIComponent(newsId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a news item (coaching staff, is_club_trainer)
   * 
   * `DELETE /news/{newsId}`
   */
  async deleteNewsByNewsId(newsId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/news/${encodeURIComponent(newsId)}`, { auth: true, options });
  }

  /**
   * List the caller's own notes (strictly private)
   * 
   * `GET /notes`
   */
  async getNotes(options?: RequestOptions): Promise<M.Note[]> {
    return this.request<M.Note[]>("GET", "/notes", { auth: true, options });
  }

  /**
   * Create a private note
   * 
   * `POST /notes`
   */
  async postNotes(body: M.NoteCreate, options?: RequestOptions): Promise<M.Note> {
    return this.request<M.Note>("POST", "/notes", { body, auth: true, options });
  }

  /**
   * Edit an own note
   * 
   * `PATCH /notes/{noteId}`
   */
  async patchNotesByNoteId(noteId: string, body: M.NoteUpdate, options?: RequestOptions): Promise<M.Note> {
    return this.request<M.Note>("PATCH", `/notes/${encodeURIComponent(noteId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete an own note
   * 
   * `DELETE /notes/{noteId}`
   */
  async deleteNotesByNoteId(noteId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/notes/${encodeURIComponent(noteId)}`, { auth: true, options });
  }

  /**
   * List the (role-filtered) assessments of one member
   * 
   * `GET /assessments`
   */
  async getAssessments(query: { "club_id": string; "member_id": string }, options?: RequestOptions): Promise<M.MemberAssessment[]> {
    return this.request<M.MemberAssessment[]>("GET", "/assessments", { query, auth: true, options });
  }

  /**
   * Write an assessment (team coach of the member, or the board)
   * 
   * `POST /assessments`
   */
  async postAssessments(body: M.MemberAssessmentCreate, options?: RequestOptions): Promise<M.MemberAssessment> {
    return this.request<M.MemberAssessment>("POST", "/assessments", { body, auth: true, options });
  }

  /**
   * Edit an assessment (author or board)
   * 
   * `PATCH /assessments/{assessmentId}`
   */
  async patchAssessmentsByAssessmentId(assessmentId: string, body: M.MemberAssessmentUpdate, options?: RequestOptions): Promise<M.MemberAssessment> {
    return this.request<M.MemberAssessment>("PATCH", `/assessments/${encodeURIComponent(assessmentId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete an assessment (author or board)
   * 
   * `DELETE /assessments/{assessmentId}`
   */
  async deleteAssessmentsByAssessmentId(assessmentId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/assessments/${encodeURIComponent(assessmentId)}`, { auth: true, options });
  }

  /**
   * List the internal coach notes about one member (never visible to the member or their guardians)
   * 
   * `GET /coach-notes`
   */
  async getCoachNotes(query: { "club_id": string; "member_id": string }, options?: RequestOptions): Promise<M.MemberCoachNote[]> {
    return this.request<M.MemberCoachNote[]>("GET", "/coach-notes", { query, auth: true, options });
  }

  /**
   * Write an internal coach note about a member (coach of that member, or the board)
   * 
   * `POST /coach-notes`
   */
  async postCoachNotes(body: M.MemberCoachNoteCreate, options?: RequestOptions): Promise<M.MemberCoachNote> {
    return this.request<M.MemberCoachNote>("POST", "/coach-notes", { body, auth: true, options });
  }

  /**
   * Edit an internal coach note (author or board)
   * 
   * `PATCH /coach-notes/{noteId}`
   */
  async patchCoachNotesByNoteId(noteId: string, body: M.MemberCoachNoteUpdate, options?: RequestOptions): Promise<M.MemberCoachNote> {
    return this.request<M.MemberCoachNote>("PATCH", `/coach-notes/${encodeURIComponent(noteId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete an internal coach note (author or board)
   * 
   * `DELETE /coach-notes/{noteId}`
   */
  async deleteCoachNotesByNoteId(noteId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/coach-notes/${encodeURIComponent(noteId)}`, { auth: true, options });
  }

  /**
   * Support tickets of one club (club board only)
   * 
   * `GET /support/tickets`
   */
  async getSupportTickets(query: { "club_id": string }, options?: RequestOptions): Promise<M.SupportTicket[]> {
    return this.request<M.SupportTicket[]>("GET", "/support/tickets", { query, auth: true, options });
  }

  /**
   * Open a support ticket (club board only)
   * 
   * `POST /support/tickets`
   */
  async postSupportTickets(body: M.SupportTicketCreate, options?: RequestOptions): Promise<M.SupportTicketDetail> {
    return this.request<M.SupportTicketDetail>("POST", "/support/tickets", { body, auth: true, options });
  }

  /**
   * One ticket incl. its message history (club board or operator)
   * 
   * `GET /support/tickets/{ticketId}`
   */
  async getSupportTicketsByTicketId(ticketId: string, options?: RequestOptions): Promise<M.SupportTicketDetail> {
    return this.request<M.SupportTicketDetail>("GET", `/support/tickets/${encodeURIComponent(ticketId)}`, { auth: true, options });
  }

  /**
   * Set status/priority of a ticket (platform operator only)
   * 
   * `PATCH /support/tickets/{ticketId}`
   */
  async patchSupportTicketsByTicketId(ticketId: string, body: M.SupportTicketUpdate, options?: RequestOptions): Promise<M.SupportTicketDetail> {
    return this.request<M.SupportTicketDetail>("PATCH", `/support/tickets/${encodeURIComponent(ticketId)}`, { body, auth: true, options });
  }

  /**
   * Reply to a ticket (club board or operator)
   * 
   * `POST /support/tickets/{ticketId}/messages`
   */
  async postSupportTicketsByTicketIdMessages(ticketId: string, body: M.SupportMessageCreate, options?: RequestOptions): Promise<M.SupportTicketDetail> {
    return this.request<M.SupportTicketDetail>("POST", `/support/tickets/${encodeURIComponent(ticketId)}/messages`, { body, auth: true, options });
  }

  /**
   * All support tickets across all clubs (platform admin only)
   * 
   * `GET /platform/support/tickets`
   */
  async getPlatformSupportTickets(query?: { "club_id"?: string }, options?: RequestOptions): Promise<M.SupportTicket[]> {
    return this.request<M.SupportTicket[]>("GET", "/platform/support/tickets", { query, auth: true, options });
  }

  /**
   * List exercises of a club (optionally filtered by category)
   * 
   * `GET /exercises`
   */
  async getExercises(query: { "club_id": string; "category"?: M.ExerciseCategory }, options?: RequestOptions): Promise<M.Exercise[]> {
    return this.request<M.Exercise[]>("GET", "/exercises", { query, auth: true, options });
  }

  /**
   * Create an exercise (coaching staff, is_club_trainer)
   * 
   * `POST /exercises`
   */
  async postExercises(body: M.ExerciseCreate, options?: RequestOptions): Promise<M.Exercise> {
    return this.request<M.Exercise>("POST", "/exercises", { body, auth: true, options });
  }

  /**
   * Edit an exercise (coaching staff, is_club_trainer)
   * 
   * `PATCH /exercises/{exerciseId}`
   */
  async patchExercisesByExerciseId(exerciseId: string, body: M.ExerciseUpdate, options?: RequestOptions): Promise<M.Exercise> {
    return this.request<M.Exercise>("PATCH", `/exercises/${encodeURIComponent(exerciseId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete an exercise (coaching staff, is_club_trainer)
   * 
   * `DELETE /exercises/{exerciseId}`
   */
  async deleteExercisesByExerciseId(exerciseId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/exercises/${encodeURIComponent(exerciseId)}`, { auth: true, options });
  }

  /**
   * List facilities of a club
   * 
   * `GET /facilities`
   */
  async getFacilities(query: { "club_id": string }, options?: RequestOptions): Promise<M.Facility[]> {
    return this.request<M.Facility[]>("GET", "/facilities", { query, auth: true, options });
  }

  /**
   * Create a facility (coaching staff, is_club_trainer)
   * 
   * `POST /facilities`
   */
  async postFacilities(body: M.FacilityCreate, options?: RequestOptions): Promise<M.Facility> {
    return this.request<M.Facility>("POST", "/facilities", { body, auth: true, options });
  }

  /**
   * Edit a facility (coaching staff, is_club_trainer)
   * 
   * `PATCH /facilities/{facilityId}`
   */
  async patchFacilitiesByFacilityId(facilityId: string, body: M.FacilityUpdate, options?: RequestOptions): Promise<M.Facility> {
    return this.request<M.Facility>("PATCH", `/facilities/${encodeURIComponent(facilityId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a facility (coaching staff, is_club_trainer)
   * 
   * `DELETE /facilities/{facilityId}`
   */
  async deleteFacilitiesByFacilityId(facilityId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/facilities/${encodeURIComponent(facilityId)}`, { auth: true, options });
  }

  /**
   * List bookings of a club (optionally filtered by facility)
   * 
   * `GET /facility-bookings`
   */
  async getFacilityBookings(query: { "club_id": string; "facility_id"?: string }, options?: RequestOptions): Promise<M.FacilityBooking[]> {
    return this.request<M.FacilityBooking[]>("GET", "/facility-bookings", { query, auth: true, options });
  }

  /**
   * Create a booking (coaching staff only, is_club_trainer)
   * 
   * `POST /facility-bookings`
   */
  async postFacilityBookings(body: M.FacilityBookingCreate, options?: RequestOptions): Promise<M.FacilityBooking> {
    return this.request<M.FacilityBooking>("POST", "/facility-bookings", { body, auth: true, options });
  }

  /**
   * Edit a booking (creator or coaching staff)
   * 
   * `PATCH /facility-bookings/{bookingId}`
   */
  async patchFacilityBookingsByBookingId(bookingId: string, body: M.FacilityBookingUpdate, options?: RequestOptions): Promise<M.FacilityBooking> {
    return this.request<M.FacilityBooking>("PATCH", `/facility-bookings/${encodeURIComponent(bookingId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a booking (creator or coaching staff)
   * 
   * `DELETE /facility-bookings/{bookingId}`
   */
  async deleteFacilityBookingsByBookingId(bookingId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/facility-bookings/${encodeURIComponent(bookingId)}`, { auth: true, options });
  }

  /**
   * List equipment of a club
   * 
   * `GET /equipment`
   */
  async getEquipment(query: { "club_id": string }, options?: RequestOptions): Promise<M.Equipment[]> {
    return this.request<M.Equipment[]>("GET", "/equipment", { query, auth: true, options });
  }

  /**
   * Create an equipment item (coaching staff, is_club_trainer)
   * 
   * `POST /equipment`
   */
  async postEquipment(body: M.EquipmentCreate, options?: RequestOptions): Promise<M.Equipment> {
    return this.request<M.Equipment>("POST", "/equipment", { body, auth: true, options });
  }

  /**
   * Edit an equipment item (coaching staff, is_club_trainer)
   * 
   * `PATCH /equipment/{equipmentId}`
   */
  async patchEquipmentByEquipmentId(equipmentId: string, body: M.EquipmentUpdate, options?: RequestOptions): Promise<M.Equipment> {
    return this.request<M.Equipment>("PATCH", `/equipment/${encodeURIComponent(equipmentId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete an equipment item (coaching staff, is_club_trainer)
   * 
   * `DELETE /equipment/{equipmentId}`
   */
  async deleteEquipmentByEquipmentId(equipmentId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/equipment/${encodeURIComponent(equipmentId)}`, { auth: true, options });
  }

  /**
   * List reservations of a club (optionally filtered by equipment)
   * 
   * `GET /equipment-reservations`
   */
  async getEquipmentReservations(query: { "club_id": string; "equipment_id"?: string }, options?: RequestOptions): Promise<M.EquipmentReservation[]> {
    return this.request<M.EquipmentReservation[]>("GET", "/equipment-reservations", { query, auth: true, options });
  }

  /**
   * Create a reservation (staff for anyone, or a member for themselves)
   * 
   * `POST /equipment-reservations`
   */
  async postEquipmentReservations(body: M.EquipmentReservationCreate, options?: RequestOptions): Promise<M.EquipmentReservation> {
    return this.request<M.EquipmentReservation>("POST", "/equipment-reservations", { body, auth: true, options });
  }

  /**
   * Edit a reservation (creator or coaching staff)
   * 
   * `PATCH /equipment-reservations/{reservationId}`
   */
  async patchEquipmentReservationsByReservationId(reservationId: string, body: M.EquipmentReservationUpdate, options?: RequestOptions): Promise<M.EquipmentReservation> {
    return this.request<M.EquipmentReservation>("PATCH", `/equipment-reservations/${encodeURIComponent(reservationId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a reservation (creator or coaching staff)
   * 
   * `DELETE /equipment-reservations/{reservationId}`
   */
  async deleteEquipmentReservationsByReservationId(reservationId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/equipment-reservations/${encodeURIComponent(reservationId)}`, { auth: true, options });
  }

  /**
   * List medals of a club (optionally filtered by member)
   * 
   * `GET /achievements`
   */
  async getAchievements(query: { "club_id": string; "member_id"?: string }, options?: RequestOptions): Promise<M.Achievement[]> {
    return this.request<M.Achievement[]>("GET", "/achievements", { query, auth: true, options });
  }

  /**
   * Award a medal (coaching staff, is_club_trainer)
   * 
   * `POST /achievements`
   */
  async postAchievements(body: M.AchievementCreate, options?: RequestOptions): Promise<M.Achievement> {
    return this.request<M.Achievement>("POST", "/achievements", { body, auth: true, options });
  }

  /**
   * Edit a medal (coaching staff, is_club_trainer)
   * 
   * `PATCH /achievements/{achievementId}`
   */
  async patchAchievementsByAchievementId(achievementId: string, body: M.AchievementUpdate, options?: RequestOptions): Promise<M.Achievement> {
    return this.request<M.Achievement>("PATCH", `/achievements/${encodeURIComponent(achievementId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a medal (coaching staff, is_club_trainer)
   * 
   * `DELETE /achievements/{achievementId}`
   */
  async deleteAchievementsByAchievementId(achievementId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/achievements/${encodeURIComponent(achievementId)}`, { auth: true, options });
  }

  /**
   * List the weekly training slots of a club (optionally by team)
   * 
   * `GET /training-slots`
   */
  async getTrainingSlots(query: { "club_id": string; "team_id"?: string }, options?: RequestOptions): Promise<M.TrainingSlot[]> {
    return this.request<M.TrainingSlot[]>("GET", "/training-slots", { query, auth: true, options });
  }

  /**
   * Create a training slot (coaching staff, is_club_trainer)
   * 
   * `POST /training-slots`
   */
  async postTrainingSlots(body: M.TrainingSlotCreate, options?: RequestOptions): Promise<M.TrainingSlot> {
    return this.request<M.TrainingSlot>("POST", "/training-slots", { body, auth: true, options });
  }

  /**
   * Edit a training slot (coaching staff, is_club_trainer)
   * 
   * `PATCH /training-slots/{slotId}`
   */
  async patchTrainingSlotsBySlotId(slotId: string, body: M.TrainingSlotUpdate, options?: RequestOptions): Promise<M.TrainingSlot> {
    return this.request<M.TrainingSlot>("PATCH", `/training-slots/${encodeURIComponent(slotId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a training slot (coaching staff, is_club_trainer)
   * 
   * `DELETE /training-slots/{slotId}`
   */
  async deleteTrainingSlotsBySlotId(slotId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/training-slots/${encodeURIComponent(slotId)}`, { auth: true, options });
  }

  /**
   * List the duty-hour requirements of a club (optionally by team)
   * 
   * `GET /duty-requirements`
   */
  async getDutyRequirements(query: { "club_id": string; "team_id"?: string }, options?: RequestOptions): Promise<M.DutyRequirement[]> {
    return this.request<M.DutyRequirement[]>("GET", "/duty-requirements", { query, auth: true, options });
  }

  /**
   * Set a duty-hour target (coaching staff, is_club_trainer)
   * 
   * `POST /duty-requirements`
   */
  async postDutyRequirements(body: M.DutyRequirementCreate, options?: RequestOptions): Promise<M.DutyRequirement> {
    return this.request<M.DutyRequirement>("POST", "/duty-requirements", { body, auth: true, options });
  }

  /**
   * Edit a duty-hour target (coaching staff, is_club_trainer)
   * 
   * `PATCH /duty-requirements/{requirementId}`
   */
  async patchDutyRequirementsByRequirementId(requirementId: string, body: M.DutyRequirementUpdate, options?: RequestOptions): Promise<M.DutyRequirement> {
    return this.request<M.DutyRequirement>("PATCH", `/duty-requirements/${encodeURIComponent(requirementId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a duty-hour target (coaching staff, is_club_trainer)
   * 
   * `DELETE /duty-requirements/{requirementId}`
   */
  async deleteDutyRequirementsByRequirementId(requirementId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/duty-requirements/${encodeURIComponent(requirementId)}`, { auth: true, options });
  }

  /**
   * Duty-hour settlement for one member: target, approved hours, missing hours, buyout
   * Computed by the database (app.duty_buyout). Only APPROVED hours inside the requirement period count; missing hours are floored at 0 (over-fulfilment never yields a credit); without cost_per_hour_cents buyout_cents is null, not 0.
   * 
   * `GET /duty-requirements/{requirementId}/buyout`
   */
  async getDutyRequirementsByRequirementIdBuyout(requirementId: string, query: { "member_id": string }, options?: RequestOptions): Promise<M.DutyBuyout> {
    return this.request<M.DutyBuyout>("GET", `/duty-requirements/${encodeURIComponent(requirementId)}/buyout`, { query, auth: true, options });
  }

  /**
   * List duty entries (own entries, or all for coaching staff)
   * 
   * `GET /duty-entries`
   */
  async getDutyEntries(query: { "club_id": string; "member_id"?: string }, options?: RequestOptions): Promise<M.DutyEntry[]> {
    return this.request<M.DutyEntry[]>("GET", "/duty-entries", { query, auth: true, options });
  }

  /**
   * Record hours (a member for themselves, or staff for anyone)
   * 
   * `POST /duty-entries`
   */
  async postDutyEntries(body: M.DutyEntryCreate, options?: RequestOptions): Promise<M.DutyEntry> {
    return this.request<M.DutyEntry>("POST", "/duty-entries", { body, auth: true, options });
  }

  /**
   * Edit a duty entry (its member, or coaching staff)
   * 
   * `PATCH /duty-entries/{entryId}`
   */
  async patchDutyEntriesByEntryId(entryId: string, body: M.DutyEntryUpdate, options?: RequestOptions): Promise<M.DutyEntry> {
    return this.request<M.DutyEntry>("PATCH", `/duty-entries/${encodeURIComponent(entryId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a duty entry (its member, or coaching staff)
   * 
   * `DELETE /duty-entries/{entryId}`
   */
  async deleteDutyEntriesByEntryId(entryId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/duty-entries/${encodeURIComponent(entryId)}`, { auth: true, options });
  }

  /**
   * My chat channels: team channels I belong to + direct threads, newest first
   * 
   * `GET /chat/channels`
   */
  async getChatChannels(query: { "club_id": string }, options?: RequestOptions): Promise<M.ChatChannel[]> {
    return this.request<M.ChatChannel[]>("GET", "/chat/channels", { query, auth: true, options });
  }

  /**
   * People I may start a direct message with (child protection applied)
   * The picker behind "New message to ...". Returns the club roster MINUS myself, minus everyone app.chat_dm_allowed (migration 0043) forbids me to write to: an adult only reaches a minor as their guardian or as a coach of one of the minor teams, and the same holds the other way round. The rows go through the SAME redaction as GET /clubs/{clubId}/members (redactMemberForViewer): a viewer without can_manage_members sees names only - no birth_date, email, phone, postal_address, valid_until, profile_id, joined_on. A coach (not guest_coach) additionally sees the parent contact data (birth_date/email/phone/postal_address) of members of their OWN teams, row-scoped like the roster. This endpoint is deliberately not a second, wider way into the roster.
   * 
   * `GET /chat/recipients`
   */
  async getChatRecipients(query: { "club_id": string }, options?: RequestOptions): Promise<M.ClubMember[]> {
    return this.request<M.ClubMember[]>("GET", "/chat/recipients", { query, auth: true, options });
  }

  /**
   * List messages of one channel (team by team_id, direct by peer_member_id)
   * 
   * `GET /chat/messages`
   */
  async getChatMessages(query: { "club_id": string; "channel_type": "team" | "direct"; "team_id"?: string; "peer_member_id"?: string }, options?: RequestOptions): Promise<M.ChatMessage[]> {
    return this.request<M.ChatMessage[]>("GET", "/chat/messages", { query, auth: true, options });
  }

  /**
   * Send a message (team channel or direct); sender is always the caller
   * 
   * `POST /chat/messages`
   */
  async postChatMessages(body: M.ChatMessageCreate, options?: RequestOptions): Promise<M.ChatMessage> {
    return this.request<M.ChatMessage>("POST", "/chat/messages", { body, auth: true, options });
  }

  /**
   * Soft-delete a message (only the sender)
   * 
   * `DELETE /chat/messages/{messageId}`
   */
  async deleteChatMessagesByMessageId(messageId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/chat/messages/${encodeURIComponent(messageId)}`, { auth: true, options });
  }

  /**
   * Report a chat message as a violation (any club member)
   * Files a report about a message the caller can see. The reporter_ip is set by the SERVER from the request (never the client), and the snapshot (message text + a little context + timestamp) is built server-side under the reporter's own RLS — so a report can only capture what the reporter is actually allowed to see. reported_member_id is the sender of the reported message. The report is visible to the club board, the platform operator, and the reporter (their own report only). Reporting a message you cannot see is a 404.
   * 
   * `POST /chat/reports`
   */
  async postChatReports(body: M.ChatReportCreate, options?: RequestOptions): Promise<M.ChatReport> {
    return this.request<M.ChatReport>("POST", "/chat/reports", { body, auth: true, options });
  }

  /**
   * Chat reports of one club (club board + platform operator)
   * The board's queue of reported chat messages. Visible to owner/admin/moderator of the club and to the platform operator; RLS enforces the same. A plain member (even the reporter) gets an honest 403 here — this is the board's queue, not a self-view.
   * 
   * `GET /chat/reports`
   */
  async getChatReports(query: { "club_id": string }, options?: RequestOptions): Promise<M.ChatReport[]> {
    return this.request<M.ChatReport[]>("GET", "/chat/reports", { query, auth: true, options });
  }

  /**
   * Set the processing state of a report (club board + platform operator)
   * Changes only the processing state; handled_by (the handler's own member row, null for the operator) and handled_at are set server-side. The report's core (reason, snapshot, who/whom, ip, timestamp) is append-only (DB trigger). An invisible report is a 404.
   * 
   * `PATCH /chat/reports/{reportId}`
   */
  async patchChatReportsByReportId(reportId: string, body: M.ChatReportUpdate, options?: RequestOptions): Promise<M.ChatReport> {
    return this.request<M.ChatReport>("PATCH", `/chat/reports/${encodeURIComponent(reportId)}`, { body, auth: true, options });
  }

  /**
   * List check-ins (own history, or the whole club for coaching staff)
   * 
   * `GET /checkins`
   */
  async getCheckins(query: { "club_id": string; "member_id"?: string }, options?: RequestOptions): Promise<M.Checkin[]> {
    return this.request<M.Checkin[]>("GET", "/checkins", { query, auth: true, options });
  }

  /**
   * Check in (a member for themselves, or staff for anyone)
   * 
   * `POST /checkins`
   */
  async postCheckins(body: M.CheckinCreate, options?: RequestOptions): Promise<M.Checkin> {
    return this.request<M.Checkin>("POST", "/checkins", { body, auth: true, options });
  }

  /**
   * Soft-delete a check-in (coaching staff only)
   * 
   * `DELETE /checkins/{checkinId}`
   */
  async deleteCheckinsByCheckinId(checkinId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/checkins/${encodeURIComponent(checkinId)}`, { auth: true, options });
  }

  /**
   * List supra-regional events (soonest first)
   * 
   * `GET /regional-events`
   */
  async getRegionalEvents(query: { "club_id": string }, options?: RequestOptions): Promise<M.RegionalEvent[]> {
    return this.request<M.RegionalEvent[]>("GET", "/regional-events", { query, auth: true, options });
  }

  /**
   * Create a regional event (coaching staff, is_club_trainer)
   * 
   * `POST /regional-events`
   */
  async postRegionalEvents(body: M.RegionalEventCreate, options?: RequestOptions): Promise<M.RegionalEvent> {
    return this.request<M.RegionalEvent>("POST", "/regional-events", { body, auth: true, options });
  }

  /**
   * Edit a regional event (coaching staff, is_club_trainer)
   * 
   * `PATCH /regional-events/{eventId}`
   */
  async patchRegionalEventsByEventId(eventId: string, body: M.RegionalEventUpdate, options?: RequestOptions): Promise<M.RegionalEvent> {
    return this.request<M.RegionalEvent>("PATCH", `/regional-events/${encodeURIComponent(eventId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a regional event (coaching staff, is_club_trainer)
   * 
   * `DELETE /regional-events/{eventId}`
   */
  async deleteRegionalEventsByEventId(eventId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/regional-events/${encodeURIComponent(eventId)}`, { auth: true, options });
  }

  /**
   * List gallery items (PRO; newest first)
   * 
   * `GET /gallery`
   */
  async getGallery(query: { "club_id": string }, options?: RequestOptions): Promise<M.GalleryItem[]> {
    return this.request<M.GalleryItem[]>("GET", "/gallery", { query, auth: true, options });
  }

  /**
   * Add a gallery item after upload (PRO; coaching staff)
   * 
   * `POST /gallery`
   */
  async postGallery(body: M.GalleryItemCreate, options?: RequestOptions): Promise<M.GalleryItem> {
    return this.request<M.GalleryItem>("POST", "/gallery", { body, auth: true, options });
  }

  /**
   * Soft-delete a gallery item (PRO; coaching staff)
   * 
   * `DELETE /gallery/{itemId}`
   */
  async deleteGalleryByItemId(itemId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/gallery/${encodeURIComponent(itemId)}`, { auth: true, options });
  }

  /**
   * Tag a person on a gallery photo (staff; no consent required to tag)
   * 
   * `POST /photo-tags`
   */
  async postPhotoTags(body: M.PhotoTagCreate, options?: RequestOptions): Promise<M.PhotoTag> {
    return this.request<M.PhotoTag>("POST", "/photo-tags", { body, auth: true, options });
  }

  /**
   * List tags on a gallery item (management view; RLS-scoped)
   * 
   * `GET /gallery/{itemId}/tags`
   */
  async getGalleryByItemIdTags(itemId: string, options?: RequestOptions): Promise<M.PhotoTag[]> {
    return this.request<M.PhotoTag[]>("GET", `/gallery/${encodeURIComponent(itemId)}/tags`, { auth: true, options });
  }

  /**
   * Photos a member appears on — consent-gated (photos_internal)
   * 
   * `GET /members/{memberId}/photos`
   */
  async getMembersByMemberIdPhotos(memberId: string, query: { "club_id": string }, options?: RequestOptions): Promise<M.MemberPhoto[]> {
    return this.request<M.MemberPhoto[]>("GET", `/members/${encodeURIComponent(memberId)}/photos`, { query, auth: true, options });
  }

  /**
   * Remove a photo tag (the tagged person, a guardian, or staff)
   * 
   * `DELETE /photo-tags/{tagId}`
   */
  async deletePhotoTagsByTagId(tagId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/photo-tags/${encodeURIComponent(tagId)}`, { auth: true, options });
  }

  /**
   * List documents (PRO; newest first)
   * 
   * `GET /documents`
   */
  async getDocuments(query: { "club_id": string }, options?: RequestOptions): Promise<M.Document[]> {
    return this.request<M.Document[]>("GET", "/documents", { query, auth: true, options });
  }

  /**
   * Add a document after upload (PRO; coaching staff)
   * 
   * `POST /documents`
   */
  async postDocuments(body: M.DocumentCreate, options?: RequestOptions): Promise<M.Document> {
    return this.request<M.Document>("POST", "/documents", { body, auth: true, options });
  }

  /**
   * Soft-delete a document (PRO; coaching staff)
   * 
   * `DELETE /documents/{documentId}`
   */
  async deleteDocumentsByDocumentId(documentId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/documents/${encodeURIComponent(documentId)}`, { auth: true, options });
  }

  /**
   * Club evaluation summary (is_club_trainer / is_club_admin only)
   * 
   * `GET /reports/summary`
   */
  async getReportsSummary(query: { "club_id": string }, options?: RequestOptions): Promise<M.ReportSummary> {
    return this.request<M.ReportSummary>("GET", "/reports/summary", { query, auth: true, options });
  }

  /**
   * Annual financial close (Jahresabschluss) - can_manage_finance only
   * 
   * `GET /reports/annual`
   */
  async getReportsAnnual(query: { "club_id": string; "year": number }, options?: RequestOptions): Promise<M.AnnualReport> {
    return this.request<M.AnnualReport>("GET", "/reports/annual", { query, auth: true, options });
  }

  /**
   * Jubilaeen & Geburtstage / Upcoming anniversaries & birthdays (anniversaries)
   * Zwei verschiedene Dinge in einer Liste: kind=birthday liefert Tag und Monat OHNE Jahre (years=null) — der Verein soll wissen, WANN jemand Geburtstag hat, nicht WIE ALT er wird. Es werden bewusst ALLE Geburtstage gezeigt und nicht nur runde: waeren es nur runde, verriete schon die Anwesenheit in der Liste das Alter. kind=membership ("10 Jahre dabei") erscheint NUR fuer Aufrufer mit member_contact >= read_all: aus dem Jubilaeumsdatum laesst sich joined_on rekonstruieren, und joined_on ist eine redigierte Roster-Spalte. Alle anderen bekommen ausschliesslich Geburtstage. Abschaltbar ueber die Faehigkeit `anniversaries` im Admin.
   * 
   * `GET /reports/anniversaries`
   */
  async getReportsAnniversaries(query: { "club_id": string }, options?: RequestOptions): Promise<M.Anniversary[]> {
    return this.request<M.Anniversary[]>("GET", "/reports/anniversaries", { query, auth: true, options });
  }

  /**
   * List club departments (is_club_member)
   * 
   * `GET /departments`
   */
  async getDepartments(query: { "club_id": string }, options?: RequestOptions): Promise<M.Department[]> {
    return this.request<M.Department[]>("GET", "/departments", { query, auth: true, options });
  }

  /**
   * Create a department (is_club_admin)
   * 
   * `POST /departments`
   */
  async postDepartments(body: M.DepartmentCreate, options?: RequestOptions): Promise<M.Department> {
    return this.request<M.Department>("POST", "/departments", { body, auth: true, options });
  }

  /**
   * Edit a department (is_club_admin)
   * 
   * `PATCH /departments/{departmentId}`
   */
  async patchDepartmentsByDepartmentId(departmentId: string, body: M.DepartmentUpdate, options?: RequestOptions): Promise<M.Department> {
    return this.request<M.Department>("PATCH", `/departments/${encodeURIComponent(departmentId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a department (is_club_admin)
   * 
   * `DELETE /departments/{departmentId}`
   */
  async deleteDepartmentsByDepartmentId(departmentId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/departments/${encodeURIComponent(departmentId)}`, { auth: true, options });
  }

  /**
   * Replace a department roster (is_club_trainer)
   * Full replace. Member ids must belong to the department's club. Missing members are soft-detached; previously removed members are revived. Assigning is trainer work (is_club_trainer).
   * 
   * `PUT /departments/{departmentId}/members`
   */
  async putDepartmentsByDepartmentIdMembers(departmentId: string, body: M.DepartmentMembersSet, options?: RequestOptions): Promise<M.Department> {
    return this.request<M.Department>("PUT", `/departments/${encodeURIComponent(departmentId)}/members`, { body, auth: true, options });
  }

  /**
   * List club lockers (is_club_member)
   * 
   * `GET /lockers`
   */
  async getLockers(query: { "club_id": string }, options?: RequestOptions): Promise<M.Locker[]> {
    return this.request<M.Locker[]>("GET", "/lockers", { query, auth: true, options });
  }

  /**
   * Create a locker (owner/admin/treasurer)
   * 
   * `POST /lockers`
   */
  async postLockers(body: M.LockerCreate, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("POST", "/lockers", { body, auth: true, options });
  }

  /**
   * Edit a locker master data (owner/admin/treasurer)
   * 
   * `PATCH /lockers/{lockerId}`
   */
  async patchLockersByLockerId(lockerId: string, body: M.LockerUpdate, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("PATCH", `/lockers/${encodeURIComponent(lockerId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a locker (owner/admin/treasurer)
   * 
   * `DELETE /lockers/{lockerId}`
   */
  async deleteLockersByLockerId(lockerId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/lockers/${encodeURIComponent(lockerId)}`, { auth: true, options });
  }

  /**
   * Assign a locker to a member (owner/admin/treasurer)
   * 
   * `PATCH /lockers/{lockerId}/assign`
   */
  async patchLockersByLockerIdAssign(lockerId: string, body: M.LockerAssign, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("PATCH", `/lockers/${encodeURIComponent(lockerId)}/assign`, { body, auth: true, options });
  }

  /**
   * Release a locker (owner/admin/treasurer)
   * 
   * `PATCH /lockers/{lockerId}/release`
   */
  async patchLockersByLockerIdRelease(lockerId: string, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("PATCH", `/lockers/${encodeURIComponent(lockerId)}/release`, { auth: true, options });
  }

  /**
   * List locker rentals (RLS: locker managers see all, members their own / their children's)
   * Optional filters: member_id, locker_id, status. A member only ever sees their own or their child's rental regardless of the filter — the RLS policy locker_rentals_select decides.
   * 
   * `GET /locker-rentals`
   */
  async getLockerRentals(query: { "club_id": string; "member_id"?: string; "locker_id"?: string; "status"?: M.LockerRentalStatus }, options?: RequestOptions): Promise<M.LockerRental[]> {
    return this.request<M.LockerRental[]>("GET", "/locker-rentals", { query, auth: true, options });
  }

  /**
   * Rent out a locker (owner/admin/treasurer)
   * The agreed price may differ from the locker list price and may be null ("not set") or 0 (explicitly free). A locker can only have ONE active rental at a time (unique index).
   * 
   * `POST /locker-rentals`
   */
  async postLockerRentals(body: M.LockerRentalCreate, options?: RequestOptions): Promise<M.LockerRental> {
    return this.request<M.LockerRental>("POST", "/locker-rentals", { body, auth: true, options });
  }

  /**
   * Edit a locker rental: price, period, status (owner/admin/treasurer)
   * club_id, locker_id and member_id are immutable in the database — a different locker means a NEW rental and ending the old one. That keeps payment history attributable.
   * 
   * `PATCH /locker-rentals/{rentalId}`
   */
  async patchLockerRentalsByRentalId(rentalId: string, body: M.LockerRentalUpdate, options?: RequestOptions): Promise<M.LockerRental> {
    return this.request<M.LockerRental>("PATCH", `/locker-rentals/${encodeURIComponent(rentalId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a locker rental (owner/admin/treasurer)
   * Use this only for a rental entered by mistake. A rental that really happened is ENDED (status beendet/gekuendigt), not deleted — the history is what makes the money traceable.
   * 
   * `DELETE /locker-rentals/{rentalId}`
   */
  async deleteLockerRentalsByRentalId(rentalId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/locker-rentals/${encodeURIComponent(rentalId)}`, { auth: true, options });
  }

  /**
   * List invoices (RLS: finance roles see all, members their own/children)
   * Optional filters: status (draft/open/paid/cancelled) and member_id. Members only ever see their own / their children's invoices regardless of the filter (RLS).
   * 
   * `GET /invoices`
   */
  async getInvoices(query: { "club_id": string; "status"?: M.InvoiceStatus; "member_id"?: string }, options?: RequestOptions): Promise<M.Invoice[]> {
    return this.request<M.Invoice[]>("GET", "/invoices", { query, auth: true, options });
  }

  /**
   * Create an invoice (owner/admin/treasurer) with a race-free number
   * Service-mode operation: the invoice number comes from app.next_invoice_number() (service_role only). The finance role is re-verified against the database, not just claims.
   * 
   * `POST /invoices`
   */
  async postInvoices(body: M.InvoiceCreate, options?: RequestOptions): Promise<M.Invoice> {
    return this.request<M.Invoice>("POST", "/invoices", { body, auth: true, options });
  }

  /**
   * Invoice detail (RLS: finance sees all, members their own/children)
   * 
   * `GET /invoices/{invoiceId}`
   */
  async getInvoicesByInvoiceId(invoiceId: string, options?: RequestOptions): Promise<M.Invoice> {
    return this.request<M.Invoice>("GET", `/invoices/${encodeURIComponent(invoiceId)}`, { auth: true, options });
  }

  /**
   * Invoice lifecycle: issue, paid, partially paid or cancelled (can_manage_finance)
   * draft → open (ISSUE a finished draft, sets issued_on), open → paid (optionally posts a matching Kassenbuch income row, post_to_ledger=true), open/partially_paid → partially_paid (paid_cents is the CUMULATIVE amount received, so reporting the same payment twice cannot double-count), or draft/open/partially_paid → cancelled. "open" is ONLY reachable from a draft — a paid/cancelled invoice is never re-opened (GoBD). The impersonated UPDATE keeps the invoices_update RLS policy as the second gate.
   * 
   * `PATCH /invoices/{invoiceId}`
   */
  async patchInvoicesByInvoiceId(invoiceId: string, body: M.InvoiceUpdate, options?: RequestOptions): Promise<M.Invoice> {
    return this.request<M.Invoice>("PATCH", `/invoices/${encodeURIComponent(invoiceId)}`, { body, auth: true, options });
  }

  /**
   * Send a payment reminder (stub: bumps dunning_level + logs)
   * 
   * `POST /invoices/{invoiceId}/send-reminder`
   */
  async postInvoicesByInvoiceIdSendReminder(invoiceId: string, options?: RequestOptions): Promise<M.Invoice> {
    return this.request<M.Invoice>("POST", `/invoices/${encodeURIComponent(invoiceId)}/send-reminder`, { auth: true, options });
  }

  /**
   * List the line items of one invoice (visible to whoever may see the invoice)
   * 
   * `GET /invoice-items`
   */
  async getInvoiceItems(query: { "club_id": string; "invoice_id": string }, options?: RequestOptions): Promise<M.InvoiceItem[]> {
    return this.request<M.InvoiceItem[]>("GET", "/invoice-items", { query, auth: true, options });
  }

  /**
   * Add a line item to a DRAFT invoice (finance roles)
   * Line net/VAT/gross are computed by the database (generated columns) and must not be sent. Adding an item rewrites invoices.amount_cents and invoices.vat_total_cents from the items.
   * 
   * `POST /invoice-items`
   */
  async postInvoiceItems(body: M.InvoiceItemCreate, options?: RequestOptions): Promise<M.InvoiceItem> {
    return this.request<M.InvoiceItem>("POST", "/invoice-items", { body, auth: true, options });
  }

  /**
   * Edit a line item of a DRAFT invoice (finance roles)
   * 
   * `PATCH /invoice-items/{itemId}`
   */
  async patchInvoiceItemsByItemId(itemId: string, body: M.InvoiceItemUpdate, options?: RequestOptions): Promise<M.InvoiceItem> {
    return this.request<M.InvoiceItem>("PATCH", `/invoice-items/${encodeURIComponent(itemId)}`, { body, auth: true, options });
  }

  /**
   * Remove a line item from a DRAFT invoice (finance roles)
   * Hard delete — a draft is not a booking. Removing the LAST item leaves the invoice at amount_cents = 0, which is the only honest answer for an invoice without items.
   * 
   * `DELETE /invoice-items/{itemId}`
   */
  async deleteInvoiceItemsByItemId(itemId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/invoice-items/${encodeURIComponent(itemId)}`, { auth: true, options });
  }

  /**
   * Invoice letterhead/settings of a club (any club member)
   * Returns the single per-club letterhead row. 404 when the club has not configured one yet — the client treats that as "use defaults".
   * 
   * `GET /invoice-settings`
   */
  async getInvoiceSettings(query: { "club_id": string }, options?: RequestOptions): Promise<M.InvoiceSettings> {
    return this.request<M.InvoiceSettings>("GET", "/invoice-settings", { query, auth: true, options });
  }

  /**
   * Create or update a club letterhead (is_club_admin)
   * Upsert (one row per club, keyed by club_id). Only the fields sent are written; omitted fields keep their value (or the default on first creation).
   * 
   * `PATCH /invoice-settings`
   */
  async patchInvoiceSettings(body: M.InvoiceSettingsUpdate, options?: RequestOptions): Promise<M.InvoiceSettings> {
    return this.request<M.InvoiceSettings>("PATCH", "/invoice-settings", { body, auth: true, options });
  }

  /**
   * Cash book (Kassenbuch) of a club - finance roles only
   * Append-only GoBD journal (app.ledger_entries): income positive, expenses negative, corrections via reversal entries. Left-joins app.ledger_categories for the label. RLS restricts reads to can_manage_finance.
   * 
   * `GET /ledger`
   */
  async getLedger(query: { "club_id": string }, options?: RequestOptions): Promise<M.LedgerEntry[]> {
    return this.request<M.LedgerEntry[]>("GET", "/ledger", { query, auth: true, options });
  }

  /**
   * Append a cash-book entry (can_manage_finance)
   * GoBD append-only booking: amount_cents is signed (income > 0, expense < 0). Corrections are never edits - use POST /ledger/{entryId}/reverse.
   * 
   * `POST /ledger`
   */
  async postLedger(body: M.LedgerEntryCreate, options?: RequestOptions): Promise<M.LedgerEntry> {
    return this.request<M.LedgerEntry>("POST", "/ledger", { body, auth: true, options });
  }

  /**
   * Cash-book categories of a club (can_manage_finance)
   * 
   * `GET /ledger/categories`
   */
  async getLedgerCategories(query: { "club_id": string }, options?: RequestOptions): Promise<M.LedgerCategory[]> {
    return this.request<M.LedgerCategory[]>("GET", "/ledger/categories", { query, auth: true, options });
  }

  /**
   * Create a cash-book category (can_manage_finance)
   * 
   * `POST /ledger/categories`
   */
  async postLedgerCategories(body: M.LedgerCategoryCreate, options?: RequestOptions): Promise<M.LedgerCategory> {
    return this.request<M.LedgerCategory>("POST", "/ledger/categories", { body, auth: true, options });
  }

  /**
   * Reverse a cash-book entry (Storno, GoBD-safe)
   * Appends a counter-entry (negated amount, reverses_entry_id set) instead of deleting the original - the documented GoBD correction path. Finance roles only.
   * 
   * `POST /ledger/{entryId}/reverse`
   */
  async postLedgerByEntryIdReverse(entryId: string, body?: M.LedgerReverse, options?: RequestOptions): Promise<M.LedgerEntry> {
    return this.request<M.LedgerEntry>("POST", `/ledger/${encodeURIComponent(entryId)}/reverse`, { body, auth: true, options });
  }

  /**
   * List bank transactions of a club - finance roles only
   * Optional status filter (unmatched/matched/ignored). amount_cents is signed (+ Eingang / - Ausgang). RLS restricts reads to can_manage_finance.
   * 
   * `GET /bank-transactions`
   */
  async getBankTransactions(query: { "club_id": string; "status"?: M.BankTransactionStatus }, options?: RequestOptions): Promise<M.BankTransaction[]> {
    return this.request<M.BankTransaction[]>("GET", "/bank-transactions", { query, auth: true, options });
  }

  /**
   * Record a bank transaction manually (can_manage_finance)
   * 
   * `POST /bank-transactions`
   */
  async postBankTransactions(body: M.BankTransactionCreate, options?: RequestOptions): Promise<M.BankTransaction> {
    return this.request<M.BankTransaction>("POST", "/bank-transactions", { body, auth: true, options });
  }

  /**
   * Import a bank statement (rows) - all start unmatched (can_manage_finance)
   * Bulk insert of parsed statement lines. Each row: booked_on, signed amount_cents, optional purpose/counterparty. Returns the created rows (all status=unmatched).
   * 
   * `POST /bank-transactions/import`
   */
  async postBankTransactionsImport(body: M.BankTransactionImport, options?: RequestOptions): Promise<M.BankTransaction[]> {
    return this.request<M.BankTransaction[]>("POST", "/bank-transactions/import", { body, auth: true, options });
  }

  /**
   * Match a bank transaction to an invoice (can_manage_finance)
   * Links the transaction to an invoice of the SAME club and sets status=matched. post_to_ledger=true (default) additionally marks an OPEN invoice paid and appends a matching Kassenbuch income row (recorded as matched_ledger_entry_id). Already-paid invoices are linked without a second booking.
   * 
   * `PATCH /bank-transactions/{transactionId}/match`
   */
  async patchBankTransactionsByTransactionIdMatch(transactionId: string, body: M.BankTransactionMatch, options?: RequestOptions): Promise<M.BankTransaction> {
    return this.request<M.BankTransaction>("PATCH", `/bank-transactions/${encodeURIComponent(transactionId)}/match`, { body, auth: true, options });
  }

  /**
   * Ignore a bank transaction (can_manage_finance)
   * 
   * `PATCH /bank-transactions/{transactionId}/ignore`
   */
  async patchBankTransactionsByTransactionIdIgnore(transactionId: string, body?: M.BankTransactionIgnore, options?: RequestOptions): Promise<M.BankTransaction> {
    return this.request<M.BankTransaction>("PATCH", `/bank-transactions/${encodeURIComponent(transactionId)}/ignore`, { body, auth: true, options });
  }

  /**
   * List donations (RLS: finance all, member their own)
   * Optional member_id filter. A plain member only ever sees their own donation(s) regardless of the filter (RLS); finance sees everything.
   * 
   * `GET /donations`
   */
  async getDonations(query: { "club_id": string; "member_id"?: string }, options?: RequestOptions): Promise<M.Donation[]> {
    return this.request<M.Donation[]>("GET", "/donations", { query, auth: true, options });
  }

  /**
   * Create a donation (can_manage_finance) with a race-free receipt number
   * Service-mode operation: receipt_number comes from app.next_donation_receipt_number() (service_role only). The finance role is re-verified against the database, not just claims.
   * 
   * `POST /donations`
   */
  async postDonations(body: M.DonationCreate, options?: RequestOptions): Promise<M.Donation> {
    return this.request<M.Donation>("POST", "/donations", { body, auth: true, options });
  }

  /**
   * Edit or issue a donation (can_manage_finance)
   * Edit the master data (only while unissued) and/or issue the Spendenbescheinigung (issue=true → issued_at=now). An already-issued donation is frozen (GoBD): master-data edits are rejected, re-issuing is a no-op conflict.
   * 
   * `PATCH /donations/{donationId}`
   */
  async patchDonationsByDonationId(donationId: string, body: M.DonationUpdate, options?: RequestOptions): Promise<M.Donation> {
    return this.request<M.Donation>("PATCH", `/donations/${encodeURIComponent(donationId)}`, { body, auth: true, options });
  }

  /**
   * Printable Spendenbescheinigung (RLS: finance or the donor)
   * Renders the donation into a ready-to-print Bescheinigungstext (DE). Visible to finance or the donor member themselves (RLS on app.donations).
   * 
   * `GET /donations/{donationId}/receipt`
   */
  async getDonationsByDonationIdReceipt(donationId: string, options?: RequestOptions): Promise<M.DonationReceipt> {
    return this.request<M.DonationReceipt>("GET", `/donations/${encodeURIComponent(donationId)}/receipt`, { auth: true, options });
  }

  /**
   * Fee catalog of a club (any club member may read)
   * The public fee model of the club: name, amount_cents and billing period. Readable by every club member (RLS: is_club_member); only finance roles may edit.
   * 
   * `GET /membership-categories`
   */
  async getMembershipCategories(query: { "club_id": string }, options?: RequestOptions): Promise<M.MembershipCategory[]> {
    return this.request<M.MembershipCategory[]>("GET", "/membership-categories", { query, auth: true, options });
  }

  /**
   * Create a fee category (can_manage_finance)
   * 
   * `POST /membership-categories`
   */
  async postMembershipCategories(body: M.MembershipCategoryCreate, options?: RequestOptions): Promise<M.MembershipCategory> {
    return this.request<M.MembershipCategory>("POST", "/membership-categories", { body, auth: true, options });
  }

  /**
   * Update a fee category (can_manage_finance)
   * 
   * `PATCH /membership-categories/{categoryId}`
   */
  async patchMembershipCategoriesByCategoryId(categoryId: string, body: M.MembershipCategoryUpdate, options?: RequestOptions): Promise<M.MembershipCategory> {
    return this.request<M.MembershipCategory>("PATCH", `/membership-categories/${encodeURIComponent(categoryId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a fee category (can_manage_finance)
   * 
   * `DELETE /membership-categories/{categoryId}`
   */
  async deleteMembershipCategoriesByCategoryId(categoryId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/membership-categories/${encodeURIComponent(categoryId)}`, { auth: true, options });
  }

  /**
   * Expected annual fee income by period (can_manage_finance)
   * Aggregates the currently valid, active fee assignments. Effective amount = custom_amount_cents when set, else the category amount. annual_cents annualises each period (monthly×12, quarterly×4, yearly×1, once excluded from the recurring total).
   * 
   * `GET /member-fees/summary`
   */
  async getMemberFeesSummary(query: { "club_id": string }, options?: RequestOptions): Promise<M.MemberFeeSummary> {
    return this.request<M.MemberFeeSummary>("GET", "/member-fees/summary", { query, auth: true, options });
  }

  /**
   * List fee assignments (RLS: finance sees all, members their own/children)
   * Optional member_id filter. A plain member only ever sees their own / their children's assignments regardless of the filter (RLS). Left-joins the category.
   * 
   * `GET /member-fees`
   */
  async getMemberFees(query: { "club_id": string; "member_id"?: string }, options?: RequestOptions): Promise<M.MemberFee[]> {
    return this.request<M.MemberFee[]>("GET", "/member-fees", { query, auth: true, options });
  }

  /**
   * Assign a fee category to a member (can_manage_finance)
   * 
   * `POST /member-fees`
   */
  async postMemberFees(body: M.MemberFeeCreate, options?: RequestOptions): Promise<M.MemberFee> {
    return this.request<M.MemberFee>("POST", "/member-fees", { body, auth: true, options });
  }

  /**
   * Update a fee assignment (can_manage_finance)
   * 
   * `PATCH /member-fees/{feeId}`
   */
  async patchMemberFeesByFeeId(feeId: string, body: M.MemberFeeUpdate, options?: RequestOptions): Promise<M.MemberFee> {
    return this.request<M.MemberFee>("PATCH", `/member-fees/${encodeURIComponent(feeId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a fee assignment (can_manage_finance)
   * 
   * `DELETE /member-fees/{feeId}`
   */
  async deleteMemberFeesByFeeId(feeId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/member-fees/${encodeURIComponent(feeId)}`, { auth: true, options });
  }

  /**
   * Family/sibling discounts of a club (any club member may read)
   * kind=percent → value_numeric is a percentage (0–100); kind=fixed → value_numeric is a fixed cent amount. applies_from_child = the ordinal the rebate starts at ("ab dem 2. Kind" → 2). Readable by every member; only finance may edit.
   * 
   * `GET /family-discounts`
   */
  async getFamilyDiscounts(query: { "club_id": string }, options?: RequestOptions): Promise<M.FamilyDiscount[]> {
    return this.request<M.FamilyDiscount[]>("GET", "/family-discounts", { query, auth: true, options });
  }

  /**
   * Create a family discount (can_manage_finance)
   * 
   * `POST /family-discounts`
   */
  async postFamilyDiscounts(body: M.FamilyDiscountCreate, options?: RequestOptions): Promise<M.FamilyDiscount> {
    return this.request<M.FamilyDiscount>("POST", "/family-discounts", { body, auth: true, options });
  }

  /**
   * Update a family discount (can_manage_finance)
   * 
   * `PATCH /family-discounts/{discountId}`
   */
  async patchFamilyDiscountsByDiscountId(discountId: string, body: M.FamilyDiscountUpdate, options?: RequestOptions): Promise<M.FamilyDiscount> {
    return this.request<M.FamilyDiscount>("PATCH", `/family-discounts/${encodeURIComponent(discountId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a family discount (can_manage_finance)
   * 
   * `DELETE /family-discounts/{discountId}`
   */
  async deleteFamilyDiscountsByDiscountId(discountId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/family-discounts/${encodeURIComponent(discountId)}`, { auth: true, options });
  }

  /**
   * List SEPA mandates (RLS: finance sees all, members their own/children)
   * Only iban_last4 is ever returned (never a full IBAN). Optional member_id filter; a plain member only ever sees their own / their children's mandate (RLS).
   * 
   * `GET /sepa-mandates`
   */
  async getSepaMandates(query: { "club_id": string; "member_id"?: string }, options?: RequestOptions): Promise<M.SepaMandate[]> {
    return this.request<M.SepaMandate[]>("GET", "/sepa-mandates", { query, auth: true, options });
  }

  /**
   * Create a SEPA mandate (can_manage_finance)
   * DATENSCHUTZ: pass ONLY iban_last4 (4 digits) - a full IBAN is rejected by validation.
   * 
   * `POST /sepa-mandates`
   */
  async postSepaMandates(body: M.SepaMandateCreate, options?: RequestOptions): Promise<M.SepaMandate> {
    return this.request<M.SepaMandate>("POST", "/sepa-mandates", { body, auth: true, options });
  }

  /**
   * Update or revoke a SEPA mandate (can_manage_finance)
   * 
   * `PATCH /sepa-mandates/{mandateId}`
   */
  async patchSepaMandatesByMandateId(mandateId: string, body: M.SepaMandateUpdate, options?: RequestOptions): Promise<M.SepaMandate> {
    return this.request<M.SepaMandate>("PATCH", `/sepa-mandates/${encodeURIComponent(mandateId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a SEPA mandate (can_manage_finance)
   * 
   * `DELETE /sepa-mandates/{mandateId}`
   */
  async deleteSepaMandatesByMandateId(mandateId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/sepa-mandates/${encodeURIComponent(mandateId)}`, { auth: true, options });
  }

  /**
   * Club license entitlements (read-only; written only by the webhook service)
   * 
   * `GET /entitlements/{clubId}`
   */
  async getEntitlementsByClubId(clubId: string, options?: RequestOptions): Promise<M.Entitlement[]> {
    return this.request<M.Entitlement[]>("GET", `/entitlements/${encodeURIComponent(clubId)}`, { auth: true, options });
  }

  /**
   * Product catalog (single source of truth for pricing, read-only)
   * 
   * `GET /products`
   */
  async getProducts(options?: RequestOptions): Promise<M.Product[]> {
    return this.request<M.Product[]>("GET", "/products", { auth: true, options });
  }

  /**
   * Dunning run (dry_run defaults to true; stages >= 2 always need approval)
   * Computes due dunning-stage changes along the timeline +7/+21/+35/+49 days after due_on. Only stage 1 (payment reminder) is ever applied automatically (dry_run=false); every stage >= 2 is returned as pending_approval and never written by the run itself.
   * 
   * `POST /clubs/{clubId}/dunning/run`
   */
  async postClubsByClubIdDunningRun(clubId: string, body?: M.DunningRunRequest, options?: RequestOptions): Promise<M.DunningRunResult> {
    return this.request<M.DunningRunResult>("POST", `/clubs/${encodeURIComponent(clubId)}/dunning/run`, { body, auth: true, options });
  }

  /**
   * Apply a dunning stage to invoices + write the audit log (finance only)
   * Raises dunning_level to to_stage (capped at the DB max) for the given open invoices and appends one app.dunning_log row each. Stages >= 2 require approve_escalation=true - the deliberate human approval; stage 1 (reminder) is the routine step. fee_cents/interest_cents are charged PER invoice and are written onto the invoice by the database trigger - there is no configured rate and no automatic interest calculation anywhere by design.
   * 
   * `POST /clubs/{clubId}/dunning/apply`
   */
  async postClubsByClubIdDunningApply(clubId: string, body: M.DunningApplyRequest, options?: RequestOptions): Promise<M.DunningApplyResult> {
    return this.request<M.DunningApplyResult>("POST", `/clubs/${encodeURIComponent(clubId)}/dunning/apply`, { body, auth: true, options });
  }

  /**
   * Dunning audit log of a club (finance only)
   * 
   * `GET /clubs/{clubId}/dunning/log`
   */
  async getClubsByClubIdDunningLog(clubId: string, query?: { "invoice_id"?: string }, options?: RequestOptions): Promise<M.DunningLogEntry[]> {
    return this.request<M.DunningLogEntry[]>("GET", `/clubs/${encodeURIComponent(clubId)}/dunning/log`, { query, auth: true, options });
  }

}
