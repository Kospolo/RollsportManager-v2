import type { Member, Routine } from "@/lib/types";
import { ApiError } from "@/lib/api/generated";
import { readSession } from "@/lib/auth/storage";
import type { DataRepository, DunningRunOutcome } from "../types";
import { activeClubId, apiClient } from "./client";
import { moduleApiRepository } from "./modules";
import { moduleApiRepositoryBatch2 } from "./modules-batch2";
import { moduleApiRepositoryBatch3 } from "./modules-batch3";
import { moduleApiRepositoryBatch4 } from "./modules-batch4";
import { moduleApiRepositoryBatch5 } from "./modules-batch5";
import { moduleApiRepositoryCluster6a } from "./modules-cluster6a";
import { moduleApiRepositoryFinance } from "./modules-finance";
import { moduleApiRepositoryFinanceB } from "./modules-financeb";
import { moduleApiRepositoryFinanceC } from "./modules-financec";
import { moduleApiRepositoryMe } from "./modules-me";
import { moduleApiRepositoryRbac } from "./modules-rbac";
import { moduleApiRepositoryOrg } from "./modules-org";
import { moduleApiRepositoryPlatform } from "./modules-platform";
import { moduleApiRepositoryWettkampf } from "./modules-wettkampf";
import {
  mapAttendance,
  mapClub,
  mapCompetition,
  mapEvent,
  mapGuardianship,
  mapInvoice,
  mapLedgerEntry,
  mapMarker,
  mapMember,
  mapPlatformClub,
  mapPlatformStats,
  mapPlatformUser,
  mapRoutine,
  mapTask,
  mapTeam,
} from "./mappers";

/**
 * API-Implementierung der Repository-Facade — nutzt den GENERIERTEN Client
 * gegen den lokalen Dev-Stack (scripts/dev-stack.sh up, Port 3022).
 *
 * ECHTE Daten mit ECHTER RLS: der Coach sieht kein Kassenbuch, ein Member
 * nur die eigenen Rechnungen. Fehler kommen als ApiError (RFC 7807).
 *
 * Seit Contract v0.2.0 ist die Facade vollständig angebunden (Teams,
 * Familien, RSVPs, Anwesenheit, Kassenbuch, Wettkämpfe, Aufgaben) —
 * es gibt keine NotImplemented-Pfade mehr.
 */

/** Küre inkl. Marker + Scores laden (zwei Unter-Endpoints, parallel). */
function loadRoutineDetails(routineId: string) {
  return Promise.all([
    apiClient.getRoutinesByRoutineIdMarkers(routineId),
    apiClient.getRoutinesByRoutineIdScores(routineId),
  ]);
}

/** Fallback: eingeloggte Person aus dem Dev-Login-Profil synthetisieren. */
function memberFromProfile(): Member | null {
  const session = readSession();
  if (!session) return null;
  const { profile } = session;
  // Plattform-Persona: keine club_members-Zeile, keine Club-Rolle → kein Member.
  if (!profile.member_id || !profile.club_id || !profile.club_role) return null;
  const parts = profile.display_name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? (parts.pop() as string) : "";
  return {
    id: profile.member_id,
    clubId: profile.club_id,
    firstName: parts.join(" ") || profile.display_name,
    lastName,
    role: profile.club_role,
    status: "active",
    email: profile.email,
    teamIds: [],
    joinedAt: "",
  };
}

export const apiRepository: DataRepository = {
  /* ---------- Verein & Menschen ---------- */
  async getClub() {
    return mapClub(await apiClient.getClubsByClubId(activeClubId()));
  },
  async getMembers() {
    const roster = await apiClient.getClubsByClubIdMembers(activeClubId());
    return roster.map(mapMember);
  },
  async getMemberById(id) {
    const roster = await apiClient.getClubsByClubIdMembers(activeClubId());
    const hit = roster.find((m) => m.id === id);
    return hit ? mapMember(hit) : undefined;
  },
  async getTeams() {
    const teams = await apiClient.getClubsByClubIdTeams(activeClubId());
    return teams.map(mapTeam);
  },
  async getGuardianships() {
    const rows = await apiClient.getClubsByClubIdGuardianships(activeClubId());
    return rows.map(mapGuardianship);
  },
  async getCurrentUser() {
    const session = readSession();
    if (!session) throw new ApiError(401, null, "Nicht angemeldet (Dev-Login fehlt)");
    try {
      const roster = await apiClient.getClubsByClubIdMembers(activeClubId());
      const own = roster.find((m) => m.id === session.profile.member_id);
      if (own) return mapMember(own);
    } catch {
      // RLS kann den Roster einschränken — Profil-Fallback unten.
    }
    const fallback = memberFromProfile();
    if (!fallback) throw new ApiError(401, null, "Nicht angemeldet (Dev-Login fehlt)");
    return fallback;
  },

  /* ---------- Termine, RSVP & Anwesenheit ---------- */
  async getEvents() {
    const events = await apiClient.getEvents({ club_id: activeClubId() });
    return events.map(mapEvent).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  async getUpcomingEvents(withinDays = 7) {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 86_400_000);
    const events = await apiClient.getEvents({
      club_id: activeClubId(),
      from: now.toISOString(),
      to: horizon.toISOString(),
    });
    return events.map(mapEvent).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  async getAttendance() {
    const rows = await apiClient.getAttendance({ club_id: activeClubId() });
    return rows.map(mapAttendance);
  },

  /* ---------- Küren ---------- */
  async getRoutines() {
    const routines = await apiClient.getRoutines({ club_id: activeClubId() });
    return Promise.all(
      routines.map(async (w): Promise<Routine> => {
        const [markers, scores] = await loadRoutineDetails(w.id);
        return mapRoutine(w, markers, scores);
      }),
    );
  },
  async getRoutineById(id) {
    try {
      const w = await apiClient.getRoutinesByRoutineId(id);
      const [markers, scores] = await loadRoutineDetails(w.id);
      return mapRoutine(w, markers, scores);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    }
  },

  /* ---------- Finanzen ---------- */
  async getInvoices() {
    const invoices = await apiClient.getInvoices({ club_id: activeClubId() });
    return invoices
      .map(mapInvoice)
      .filter((i): i is NonNullable<typeof i> => i !== null);
  },
  async getLedger() {
    const rows = await apiClient.getLedger({ club_id: activeClubId() });
    return rows.map(mapLedgerEntry);
  },

  /* ---------- Wettkampf & Aufgaben ---------- */
  async getCompetitions() {
    const rows = await apiClient.getCompetitions({ club_id: activeClubId() });
    return rows.map(mapCompetition);
  },
  async getTasks() {
    const rows = await apiClient.getTasks({ club_id: activeClubId() });
    return rows.map(mapTask);
  },

  /* ---------- Schreibpfade ---------- */
  async setRsvp({ eventId, memberId, status, comment }) {
    await apiClient.putEventsByEventIdRsvp(eventId, {
      member_id: memberId,
      status,
      comment,
    });
    return true;
  },
  async setAttendance({ eventId, memberId, status, checkedInAt }) {
    await apiClient.putEventsByEventIdAttendance(eventId, {
      member_id: memberId,
      status,
      checked_in_at: checkedInAt,
    });
    return true;
  },
  async changeMemberRole(memberId, role) {
    await apiClient.patchClubsByClubIdMembersByMemberIdRole(activeClubId(), memberId, {
      role,
    });
    return true;
  },
  async runDunning(options): Promise<DunningRunOutcome> {
    const result = await apiClient.postClubsByClubIdDunningRun(activeClubId(), {
      dry_run: options?.dryRun ?? true,
    });
    return {
      dryRun: result.dry_run,
      total: result.actions.length,
      auto: result.summary.auto,
      pendingApproval: result.summary.pending_approval,
      none: result.summary.none,
    };
  },
  async setTaskDone(taskId, done) {
    await apiClient.patchTasksByTaskId(taskId, { done });
    return true;
  },
  async createEvent(input) {
    const created = await apiClient.postEvents({
      club_id: activeClubId(),
      type: input.type,
      title: input.title,
      location: input.location,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      team_ids: input.teamIds,
      note: input.note,
    });
    return mapEvent(created);
  },
  async inviteMember(input) {
    const queued = await apiClient.postClubsByClubIdMembersInvite(activeClubId(), {
      email: input.email,
      role: input.role,
    });
    return { email: queued.email };
  },
  async addRoutineMarker(routineId, input) {
    const created = await apiClient.postRoutinesByRoutineIdMarkers(routineId, {
      time_ms: input.timeMs,
      label: input.label,
      element_code: input.elementCode,
    });
    return mapMarker(created);
  },

  /* ---------- Verwaltung: Mitglieder-Stammdaten ---------- */
  async updateMember(memberId, patch) {
    const updated = await apiClient.patchClubsByClubIdMembersByMemberId(
      activeClubId(),
      memberId,
      {
        first_name: patch.firstName,
        last_name: patch.lastName,
        email: patch.email,
        birth_date: patch.birthDate,
        status: patch.status,
        valid_until: patch.validUntil,
      },
    );
    return mapMember(updated);
  },

  /* ---------- Verwaltung: Teams ---------- */
  async createTeam(input) {
    const created = await apiClient.postClubsByClubIdTeams(activeClubId(), {
      name: input.name,
      age_group: input.ageGroup,
    });
    return mapTeam(created);
  },
  async updateTeam(teamId, patch) {
    const updated = await apiClient.patchClubsByClubIdTeamsByTeamId(activeClubId(), teamId, {
      name: patch.name,
      age_group: patch.ageGroup,
    });
    return mapTeam(updated);
  },
  async deleteTeam(teamId) {
    const deleted = await apiClient.deleteClubsByClubIdTeamsByTeamId(activeClubId(), teamId);
    return { id: deleted.id };
  },
  async setTeamMembers(teamId, input) {
    const updated = await apiClient.putClubsByClubIdTeamsByTeamIdMembers(
      activeClubId(),
      teamId,
      {
        coach_member_ids: input.coachIds,
        skater_member_ids: input.skaterIds,
      },
    );
    return mapTeam(updated);
  },

  /* ---------- Verwaltung: Vereins-Einstellungen ---------- */
  async updateClubSettings(patch) {
    const updated = await apiClient.patchClubsByClubId(activeClubId(), {
      name: patch.name,
      short_name: patch.shortName,
      city: patch.city,
      discipline: patch.discipline,
      settings: patch.settings,
    });
    return mapClub(updated);
  },

  /* ---------- Module: Neuigkeiten, Notizen, Übungen (Batch 1) ---------- */
  ...moduleApiRepository,

  /* ---------- Module: Hallen, Buchungen, Equipment, Reservierungen, Erfolge (Batch 2) ---------- */
  ...moduleApiRepositoryBatch2,

  /* ---------- Module: Trainingsplan, Pflichtstunden, Auswertung (Batch 3) ---------- */
  ...moduleApiRepositoryBatch3,

  /* ---------- Module: Chat, Check-in, überregionale Events (Batch 4) ---------- */
  ...moduleApiRepositoryBatch4,

  /* ---------- Module: Galerie, Dokumente, Entitlement (Batch 5) ---------- */
  ...moduleApiRepositoryBatch5,

  /* ---------- Module: Wartelisten, Budget, Familie-Selfservice, Profilfoto (Cluster 6a) ---------- */
  ...moduleApiRepositoryCluster6a,

  /* ---------- Module: Kassenbuch-Kategorien, Rechnungs-Detail, Mahnwesen (Finanz A) ---------- */
  ...moduleApiRepositoryFinance,

  /* ---------- Module: Beitragskategorien, -zuordnungen, Familienrabatte, SEPA (Finanz B) ---------- */
  ...moduleApiRepositoryFinanceB,

  /* ---------- Module: Bankabgleich, Spenden, Jahresabschluss, Export (Finanz C) ---------- */
  ...moduleApiRepositoryFinanceC,

  /* ---------- Module: App-Shell-Selbstsicht (eigenes Profil + Präferenzen) ---------- */
  ...moduleApiRepositoryMe,
  ...moduleApiRepositoryRbac,

  /* ---------- Module: Abteilungen, Schließfächer, Jubiläen (Organisation) ---------- */
  ...moduleApiRepositoryOrg,

  /* ---------- Module: Rangliste, Live-Wertung, Verbandsmeldung, Kür-Teilen (Wettkampf) ---------- */
  ...moduleApiRepositoryWettkampf,

  /* ---------- Plattform-Konsole (reine Lesesicht) ---------- */
  async platformListClubs() {
    const rows = await apiClient.getPlatformClubs();
    return rows.map(mapPlatformClub);
  },
  async platformListUsers() {
    const rows = await apiClient.getPlatformUsers();
    return rows.map(mapPlatformUser);
  },
  async platformStats() {
    return mapPlatformStats(await apiClient.getPlatformStats());
  },

  /* ---------- Plattform-Konsole: Lizenzen, Zahlungen, Produkte, System, Einstellungen ---------- */
  ...moduleApiRepositoryPlatform,
};
