import * as mock from "@/lib/mock";
import type {
  Club,
  Event,
  Member,
  PlatformClubSummary,
  PlatformStats,
  PlatformUserSummary,
  RoutineMarker,
  Team,
} from "@/lib/types";
import type { DataRepository, DunningRunOutcome } from "../types";
import { openInvoices } from "../derive";
import { moduleRepository } from "./modules";
import { moduleRepositoryBatch2 } from "./modules-batch2";
import { moduleRepositoryBatch3 } from "./modules-batch3";
import { moduleRepositoryBatch4 } from "./modules-batch4";
import { moduleRepositoryBatch5 } from "./modules-batch5";
import { moduleRepositoryFinance } from "./modules-finance";
import { moduleRepositoryFinanceB } from "./modules-financeb";
import { moduleRepositoryFinanceC } from "./modules-financec";
import { moduleRepositoryMe } from "./modules-me";

/**
 * In-Memory-Ablage für im Mock-Modus angelegte/geänderte Objekte. Lebt für die
 * Dauer der Session (bis Reload) und macht die Verwaltungs-Flows auch ohne
 * Dev-Stack erfahrbar — Termine, Teams und Stammdaten-Änderungen bleiben
 * sichtbar, bis die Seite neu geladen wird.
 */
const createdEvents: Event[] = [];
const memberStore: Member[] = mock.members.map((m) => ({ ...m, teamIds: [...m.teamIds] }));
const teamStore: Team[] = mock.teams.map((t) => ({
  ...t,
  coachIds: [...t.coachIds],
  skaterIds: [...t.skaterIds],
}));
let clubStore: Club = { ...mock.club };

let teamSeq = teamStore.length;

/**
 * Mock-Implementierung der Repository-Facade — DEFAULT-Datenquelle.
 *
 * Wrappt die bestehenden lib/mock-Daten als async-Aufrufe, damit die Screens
 * gegen dieselbe Schnittstelle programmieren wie im api-Modus. Lese-Getter
 * spiegeln die In-Memory-Stores; Schreibpfade sind plausible lokale Mutationen
 * (kein echter Rollen-/Rechtecheck — die Wahrheit ist im api-Modus der Server).
 */

export const mockRepository: DataRepository = {
  /* ---------- Verein & Menschen ---------- */
  async getClub() {
    return clubStore;
  },
  async getMembers() {
    return memberStore;
  },
  async getMemberById(id) {
    return memberStore.find((m) => m.id === id);
  },
  async getTeams() {
    return teamStore;
  },
  async getGuardianships() {
    return mock.guardianships;
  },
  async getCurrentUser() {
    return memberStore[0];
  },

  /* ---------- Termine, RSVP & Anwesenheit ---------- */
  async getEvents() {
    return [...mock.events, ...createdEvents];
  },
  async getUpcomingEvents(withinDays = 7) {
    return mock.upcomingEvents(withinDays);
  },
  async getAttendance() {
    return mock.attendance;
  },

  /* ---------- Küren ---------- */
  async getRoutines() {
    return mock.routines;
  },
  async getRoutineById(id) {
    return mock.routineById(id);
  },

  /* ---------- Finanzen ---------- */
  async getInvoices() {
    return mock.invoices;
  },
  async getLedger() {
    return mock.ledger;
  },

  /* ---------- Wettkampf & Aufgaben ---------- */
  async getCompetitions() {
    return mock.competitions;
  },
  async getTasks() {
    return mock.tasks;
  },

  /* ---------- Schreibpfade (lokale No-ops / Mutationen) ---------- */
  async setRsvp() {
    return true;
  },
  async setAttendance() {
    return true;
  },
  async changeMemberRole(memberId, role) {
    const member = memberStore.find((m) => m.id === memberId);
    if (member) member.role = role;
    return true;
  },
  async runDunning(options): Promise<DunningRunOutcome> {
    // Plausibles Trockenlauf-Ergebnis aus den Mock-Rechnungen ableiten:
    // überfällige offene Posten Stufe 0 → auto (Erinnerung), Stufe ≥ 1 → Freigabe.
    const open = openInvoices(mock.invoices);
    const today = new Date().toISOString().slice(0, 10);
    const overdue = open.filter((i) => i.dueAt < today);
    const auto = overdue.filter((i) => i.dunningLevel === 0).length;
    const pendingApproval = overdue.filter((i) => i.dunningLevel >= 1).length;
    return {
      dryRun: options?.dryRun ?? true,
      total: overdue.length,
      auto,
      pendingApproval,
      none: open.length - overdue.length,
    };
  },
  async setTaskDone() {
    return true;
  },
  async createEvent(input): Promise<Event> {
    const created: Event = {
      id: `e-local-${Date.now()}`,
      clubId: clubStore.id,
      type: input.type,
      title: input.title,
      location: input.location ?? "",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      teamIds: input.teamIds ?? [],
      rsvps: [],
      note: input.note,
    };
    createdEvents.push(created);
    return created;
  },
  async inviteMember(input) {
    return { email: input.email };
  },
  async addRoutineMarker(_routineId, input): Promise<RoutineMarker> {
    return {
      id: `m-local-${Date.now()}`,
      timeMs: input.timeMs,
      label: input.label,
      elementCode: input.elementCode,
    };
  },

  /* ---------- Verwaltung: Mitglieder-Stammdaten ---------- */
  async updateMember(memberId, patch): Promise<Member> {
    const member = memberStore.find((m) => m.id === memberId);
    if (!member) throw new Error(`Mitglied ${memberId} nicht gefunden (mock)`);
    if (patch.firstName !== undefined) member.firstName = patch.firstName;
    if (patch.lastName !== undefined) member.lastName = patch.lastName;
    if (patch.email !== undefined) member.email = patch.email ?? undefined;
    if (patch.birthDate !== undefined) member.birthDate = patch.birthDate ?? undefined;
    if (patch.status !== undefined) member.status = patch.status;
    if (patch.validUntil !== undefined) member.guestAccessUntil = patch.validUntil ?? undefined;
    return member;
  },

  /* ---------- Verwaltung: Teams ---------- */
  async createTeam(input): Promise<Team> {
    const created: Team = {
      id: `t-local-${++teamSeq}`,
      clubId: clubStore.id,
      name: input.name,
      ageGroup: input.ageGroup ?? "",
      coachIds: [],
      skaterIds: [],
    };
    teamStore.push(created);
    return created;
  },
  async updateTeam(teamId, patch): Promise<Team> {
    const team = teamStore.find((t) => t.id === teamId);
    if (!team) throw new Error(`Team ${teamId} nicht gefunden (mock)`);
    if (patch.name !== undefined) team.name = patch.name;
    if (patch.ageGroup !== undefined) team.ageGroup = patch.ageGroup ?? "";
    return team;
  },
  async deleteTeam(teamId): Promise<{ id: string }> {
    const idx = teamStore.findIndex((t) => t.id === teamId);
    if (idx >= 0) teamStore.splice(idx, 1);
    return { id: teamId };
  },
  async setTeamMembers(teamId, input): Promise<Team> {
    const team = teamStore.find((t) => t.id === teamId);
    if (!team) throw new Error(`Team ${teamId} nicht gefunden (mock)`);
    const coachIds = input.coachIds ?? [];
    // Bei Überschneidung gewinnt coach (wie serverseitig) — Läufer:innen
    // werden um die Coach-IDs bereinigt.
    const skaterIds = (input.skaterIds ?? []).filter((id) => !coachIds.includes(id));
    team.coachIds = [...coachIds];
    team.skaterIds = [...skaterIds];
    // Mitglieder-Teamzuordnung konsistent nachziehen (VOLL-Replace).
    const roster = new Set([...coachIds, ...skaterIds]);
    for (const member of memberStore) {
      const inTeam = member.teamIds.includes(teamId);
      if (roster.has(member.id) && !inTeam) member.teamIds.push(teamId);
      if (!roster.has(member.id) && inTeam) {
        member.teamIds = member.teamIds.filter((id) => id !== teamId);
      }
    }
    return team;
  },

  /* ---------- Verwaltung: Vereins-Einstellungen ---------- */
  async updateClubSettings(patch): Promise<Club> {
    clubStore = {
      ...clubStore,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.shortName != null ? { shortName: patch.shortName } : {}),
      ...(patch.city != null ? { city: patch.city } : {}),
      ...(patch.discipline != null ? { discipline: patch.discipline } : {}),
    };
    return clubStore;
  },

  /* ---------- Module: Neuigkeiten, Notizen, Übungen (Batch 1) ---------- */
  ...moduleRepository,

  /* ---------- Module: Hallen, Buchungen, Equipment, Reservierungen, Erfolge (Batch 2) ---------- */
  ...moduleRepositoryBatch2,

  /* ---------- Module: Trainingsplan, Pflichtstunden, Auswertung (Batch 3) ---------- */
  ...moduleRepositoryBatch3,

  /* ---------- Module: Chat, Check-in, überregionale Events (Batch 4) ---------- */
  ...moduleRepositoryBatch4,

  /* ---------- Module: Galerie, Dokumente, Entitlement (Batch 5) ---------- */
  ...moduleRepositoryBatch5,

  /* ---------- Module: Kassenbuch-Kategorien, Rechnungs-Detail, Mahnwesen (Finanz A) ---------- */
  ...moduleRepositoryFinance,

  /* ---------- Module: Beitragskategorien, -zuordnungen, Familienrabatte, SEPA (Finanz B) ---------- */
  ...moduleRepositoryFinanceB,

  /* ---------- Module: Bankabgleich, Spenden, Jahresabschluss, Export (Finanz C) ---------- */
  ...moduleRepositoryFinanceC,

  /* ---------- Module: App-Shell-Selbstsicht (eigenes Profil + Präferenzen) ---------- */
  ...moduleRepositoryMe,

  /* ---------- Plattform-Konsole (reine Lesesicht) ---------- */
  async platformListClubs(): Promise<PlatformClubSummary[]> {
    const created = clubStore.foundedYear
      ? `${clubStore.foundedYear}-01-01T00:00:00.000Z`
      : "2015-01-01T00:00:00.000Z";
    return [
      {
        id: clubStore.id,
        name: clubStore.name,
        shortName: clubStore.shortName,
        city: clubStore.city,
        discipline: clubStore.discipline,
        memberCount: memberStore.length,
        createdAt: created,
      },
      {
        id: "club-esc-heilbronn",
        name: "ESC Heilbronn",
        shortName: "ESC",
        city: "Heilbronn",
        discipline: "Rollkunstlauf",
        memberCount: 41,
        createdAt: "2011-06-01T00:00:00.000Z",
      },
      {
        id: "club-rrc-stuttgart",
        name: "RRC Stuttgart",
        shortName: "RRC",
        city: "Stuttgart",
        discipline: "Rollhockey",
        memberCount: 68,
        createdAt: "2003-09-01T00:00:00.000Z",
      },
    ];
  },
  async platformListUsers(): Promise<PlatformUserSummary[]> {
    return memberStore
      .filter((m) => m.email)
      .map((m) => ({
        id: m.id,
        displayName: `${m.firstName} ${m.lastName}`,
        locale: "de",
        clubCount: 1,
        createdAt: `${m.joinedAt}T00:00:00.000Z`,
      }));
  },
  async platformStats(): Promise<PlatformStats> {
    return {
      clubs: 3,
      users: memberStore.filter((m) => m.email).length,
      members: memberStore.length,
      activeMembers: memberStore.filter((m) => m.status === "active").length,
      teams: teamStore.length,
      events: mock.events.length,
      openInvoices: openInvoices(mock.invoices).length,
    };
  },
};
