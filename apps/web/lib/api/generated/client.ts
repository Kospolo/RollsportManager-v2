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
   * List competitions of a club incl. entries (start list)
   * 
   * `GET /competitions`
   */
  async getCompetitions(query: { "club_id": string }, options?: RequestOptions): Promise<M.Competition[]> {
    return this.request<M.Competition[]>("GET", "/competitions", { query, auth: true, options });
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
   * List invoices (RLS: finance roles see all, members their own/children)
   * 
   * `GET /invoices`
   */
  async getInvoices(query: { "club_id": string }, options?: RequestOptions): Promise<M.Invoice[]> {
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
   * Cash book (Kassenbuch) of a club - finance roles only
   * Append-only GoBD journal (app.ledger_entries): income positive, expenses negative, corrections via reversal entries. RLS restricts reads to owner/admin/treasurer.
   * 
   * `GET /ledger`
   */
  async getLedger(query: { "club_id": string }, options?: RequestOptions): Promise<M.LedgerEntry[]> {
    return this.request<M.LedgerEntry[]>("GET", "/ledger", { query, auth: true, options });
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

}
