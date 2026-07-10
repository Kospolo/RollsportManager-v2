import * as mock from "@/lib/mock";
import type { Event, RoutineMarker } from "@/lib/types";
import type { DataRepository, DunningRunOutcome } from "../types";
import { openInvoices } from "../derive";

/**
 * In-Memory-Ablage für im Mock-Modus angelegte Objekte. Lebt für die Dauer
 * der Session (bis Reload) und macht die Anlegen-Flows auch ohne Dev-Stack
 * erfahrbar — Termine erscheinen in der Liste, Marker im Player.
 */
const createdEvents: Event[] = [];

/**
 * Mock-Implementierung der Repository-Facade — DEFAULT-Datenquelle.
 *
 * Wrappt die bestehenden lib/mock-Daten 1:1 als async-Aufrufe, damit die
 * Screens gegen dieselbe Schnittstelle programmieren wie im api-Modus.
 * Schreibpfade sind lokale No-ops, die true zurückgeben (der optimistische
 * lokale Zustand lebt weiterhin in den Screens).
 */

export const mockRepository: DataRepository = {
  /* ---------- Verein & Menschen ---------- */
  async getClub() {
    return mock.club;
  },
  async getMembers() {
    return mock.members;
  },
  async getMemberById(id) {
    return mock.memberById(id);
  },
  async getTeams() {
    return mock.teams;
  },
  async getGuardianships() {
    return mock.guardianships;
  },
  async getCurrentUser() {
    return mock.currentUser;
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

  /* ---------- Schreibpfade (lokale No-ops) ---------- */
  async setRsvp() {
    return true;
  },
  async setAttendance() {
    return true;
  },
  async changeMemberRole() {
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
      clubId: mock.club.id,
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
};
