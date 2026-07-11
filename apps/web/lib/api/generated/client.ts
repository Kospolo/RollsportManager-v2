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
   * List the club roster
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
   * Invite a person by e-mail (stub, can_manage_members)
   * Phase-1 stub: validates and logs the invite. Mail delivery + join-code flow land with the portal phase.
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
   * Change a member role (owner/admin; never self; last owner protected)
   * 
   * `PATCH /clubs/{clubId}/members/{memberId}/role`
   */
  async patchClubsByClubIdMembersByMemberIdRole(clubId: string, memberId: string, body: M.ClubMemberRoleChange, options?: RequestOptions): Promise<M.ClubMember> {
    return this.request<M.ClubMember>("PATCH", `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberId)}/role`, { body, auth: true, options });
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
   * Create a booking (staff for anyone, or a member for themselves)
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
   * Upcoming anniversaries & round birthdays (is_club_member)
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
   * Create a locker (is_club_admin)
   * 
   * `POST /lockers`
   */
  async postLockers(body: M.LockerCreate, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("POST", "/lockers", { body, auth: true, options });
  }

  /**
   * Edit a locker's master data (is_club_admin)
   * 
   * `PATCH /lockers/{lockerId}`
   */
  async patchLockersByLockerId(lockerId: string, body: M.LockerUpdate, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("PATCH", `/lockers/${encodeURIComponent(lockerId)}`, { body, auth: true, options });
  }

  /**
   * Soft-delete a locker (is_club_admin)
   * 
   * `DELETE /lockers/{lockerId}`
   */
  async deleteLockersByLockerId(lockerId: string, options?: RequestOptions): Promise<M.Deleted> {
    return this.request<M.Deleted>("DELETE", `/lockers/${encodeURIComponent(lockerId)}`, { auth: true, options });
  }

  /**
   * Assign a locker to a member (is_club_trainer)
   * 
   * `PATCH /lockers/{lockerId}/assign`
   */
  async patchLockersByLockerIdAssign(lockerId: string, body: M.LockerAssign, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("PATCH", `/lockers/${encodeURIComponent(lockerId)}/assign`, { body, auth: true, options });
  }

  /**
   * Release a locker (is_club_trainer) - status back to free
   * 
   * `PATCH /lockers/{lockerId}/release`
   */
  async patchLockersByLockerIdRelease(lockerId: string, options?: RequestOptions): Promise<M.Locker> {
    return this.request<M.Locker>("PATCH", `/lockers/${encodeURIComponent(lockerId)}/release`, { auth: true, options });
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
   * Settle an invoice: mark paid or cancelled (can_manage_finance)
   * open → paid (optionally posts a matching Kassenbuch income row, post_to_ledger=true) or draft/open → cancelled. Paid/cancelled invoices are terminal (GoBD: no re-open). The impersonated UPDATE keeps the invoices_update RLS policy as the second gate.
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
   * Raises dunning_level to to_stage (capped at the DB max) for the given open invoices and appends one app.dunning_log row each. Stages >= 2 require approve_escalation=true - the deliberate human approval; stage 1 (reminder) is the routine step.
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
