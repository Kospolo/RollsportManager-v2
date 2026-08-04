package de.rollsportmanager.v2.network

import de.rollsportmanager.contracts.Attendance
import de.rollsportmanager.contracts.AttendanceUpsert
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.ClubMemberRoleChange
import de.rollsportmanager.contracts.Competition
import de.rollsportmanager.contracts.DunningRunRequest
import de.rollsportmanager.contracts.DunningRunResult
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.EventRsvp
import de.rollsportmanager.contracts.EventRsvpUpsert
import de.rollsportmanager.contracts.Guardianship
import de.rollsportmanager.contracts.Invoice
import de.rollsportmanager.contracts.Routine
import de.rollsportmanager.contracts.RoutineMarker
import de.rollsportmanager.contracts.RoutineScore
import de.rollsportmanager.contracts.Sparte
import de.rollsportmanager.contracts.Task
import de.rollsportmanager.contracts.TaskUpdate
import de.rollsportmanager.contracts.Team

// ============================================================================
// Typisierte API-Calls — dünne Schicht über ApiClient.
//
// Alle Request-/Response-Typen kommen aus den generierten Contracts
// (packages/contracts/generated/kotlin/RsmContracts.kt) — Lücken dort bitte
// MELDEN statt hier von Hand nachbauen. Einzige Ausnahme: /dev/login
// (bewusst nicht in der Spec, Typen in DevLogin.kt).
//
// Konvention für Screen-Teams: club-gebundene Listen nehmen die `clubId`
// aus `SessionStore.session?.profile?.clubId`.
// ============================================================================

// --- Dev-Login (nur AUTH_MODE=dev, sonst 404) -------------------------------

suspend fun ApiClient.devLogin(persona: DevPersona): DevLoginResponse =
    post("/dev/login", DevLoginRequest(persona.wireName))

// --- Mitglieder --------------------------------------------------------------

suspend fun ApiClient.members(clubId: String): List<ClubMember> =
    get("/clubs/$clubId/members")

/** GET /clubs/{clubId}/teams — Teams des Vereins inkl. Läufer-/Trainer-IDs. */
suspend fun ApiClient.teams(clubId: String): List<Team> =
    get("/clubs/$clubId/teams")

/**
 * GET /clubs/{clubId}/sparten — Sparten des Vereins (Verein → Sparten → Teams).
 *
 * RLS-abhängig: Wer keine Spartensicht hat, bekommt 403 — das ist KEIN Fehler
 * der App, sondern ein legitimer Zustand. Aufrufer behandeln die Liste als
 * Kür und zeigen bei Verweigerung einfach keine Sparten-Zuordnung.
 */
suspend fun ApiClient.sparten(clubId: String): List<Sparte> =
    get("/clubs/$clubId/sparten")

/**
 * Familienmodell — RLS-scoped: owner/admin sehen alle Beziehungen,
 * Eltern/Kinder nur die eigene Familie.
 */
suspend fun ApiClient.guardianships(clubId: String): List<Guardianship> =
    get("/clubs/$clubId/guardianships")

/**
 * Rollenwechsel (owner/admin; nie sich selbst; letzter Owner geschützt).
 * Verweigerung kommt als ApiException.ProblemResponse mit status == 403,
 * Last-Owner-Schutz als 409.
 */
suspend fun ApiClient.changeMemberRole(
    clubId: String,
    memberId: String,
    change: ClubMemberRoleChange,
): ClubMember = patch("/clubs/$clubId/members/$memberId/role", change)

// --- Termine + RSVP + Anwesenheit --------------------------------------------

/**
 * `from`/`to` als volle ISO-8601-date-time-Strings — der Server validiert
 * strikt `date-time`, reines `yyyy-MM-dd` liefert 400 (gegen den Dev-Stack
 * verifiziert; Contract-Klärung offen — siehe iOS Endpoints.swift).
 */
suspend fun ApiClient.events(
    clubId: String,
    from: String? = null,
    to: String? = null,
): List<Event> = get(
    "/events",
    buildMap {
        put("club_id", clubId)
        from?.let { put("from", it) }
        to?.let { put("to", it) }
    },
)

suspend fun ApiClient.putRsvp(eventId: String, upsert: EventRsvpUpsert): EventRsvp =
    put("/events/$eventId/rsvp", upsert)

/**
 * GET /attendance — Anwesenheiten des Vereins, optional auf einen Termin
 * eingegrenzt (RLS: sichtbar, was die Rolle sehen darf).
 */
suspend fun ApiClient.attendance(clubId: String, eventId: String? = null): List<Attendance> =
    get(
        "/attendance",
        buildMap {
            put("club_id", clubId)
            eventId?.let { put("event_id", it) }
        },
    )

/** PUT /events/{eventId}/attendance — Anwesenheit erfassen (Coach+, inkl. guest_coach). */
suspend fun ApiClient.putAttendance(eventId: String, upsert: AttendanceUpsert): Attendance =
    put("/events/$eventId/attendance", upsert)

// --- Finanzen -----------------------------------------------------------------

suspend fun ApiClient.invoices(clubId: String): List<Invoice> =
    get("/invoices", mapOf("club_id" to clubId))

/**
 * Mahnlauf — Default ist Dry-Run (`DunningRunRequest(dryRun = true)`).
 * Scharfe Läufe nur nach expliziter Freigabe im UI (Kontroll-Mikrocopy!).
 */
suspend fun ApiClient.dunningRun(clubId: String, request: DunningRunRequest): DunningRunResult =
    post("/clubs/$clubId/dunning/run", request)

// --- Küren --------------------------------------------------------------------

suspend fun ApiClient.routines(clubId: String): List<Routine> =
    get("/routines", mapOf("club_id" to clubId))

suspend fun ApiClient.routine(id: String): Routine =
    get("/routines/$id")

suspend fun ApiClient.routineMarkers(routineId: String): List<RoutineMarker> =
    get("/routines/$routineId/markers")

suspend fun ApiClient.routineScores(routineId: String): List<RoutineScore> =
    get("/routines/$routineId/scores")

// --- Wettkämpfe ----------------------------------------------------------------

suspend fun ApiClient.competitions(clubId: String): List<Competition> =
    get("/competitions", mapOf("club_id" to clubId))

// --- Aufgaben ------------------------------------------------------------------
// Achtung: `Task` ist hier die Contracts-Data-Class (app.tasks), nicht
// kotlinx.coroutines — Coroutine-Jobs im Feature-Code entsprechend benennen.

suspend fun ApiClient.tasks(clubId: String): List<Task> =
    get("/tasks", mapOf("club_id" to clubId))

suspend fun ApiClient.setTaskDone(taskId: String, done: Boolean): Task =
    patch("/tasks/$taskId", TaskUpdate(done))
