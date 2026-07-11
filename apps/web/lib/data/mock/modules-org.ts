import { club, members } from "@/lib/mock";
import type { Anniversary, AnniversaryKind, Department, Locker } from "@/lib/types";
import type { OrgRepository } from "../inputs-org";
import { departmentSeed, lockerSeed } from "./seed-org";

/**
 * Mock-Implementierung der Organisations-Module (Abteilungen, Schließfächer,
 * Jubiläen). Eigene In-Memory-Stores (Session-Lebensdauer), kein echter
 * Rechtecheck — die Wahrheit ist im api-Modus der Server. Jubiläen werden zur
 * Laufzeit aus den Mock-Mitgliedern berechnet (Horizont 365 Tage).
 */

const clubId = club.id;

const nowIso = (): string => new Date().toISOString();

const departmentStore: Department[] = departmentSeed.map((d) => ({
  ...d,
  memberIds: [...d.memberIds],
}));
const lockerStore: Locker[] = lockerSeed.map((l) => ({ ...l }));

let depSeq = departmentStore.length;
let locSeq = lockerStore.length;

/** Nach (sortOrder, name) sortieren — wie serverseitig geliefert. */
function sortedDepartments(): Department[] {
  return [...departmentStore]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"))
    .map((d) => ({ ...d, memberIds: [...d.memberIds] }));
}

const MS_PER_DAY = 86_400_000;

/** Nächstes Vorkommen von Monat/Tag aus baseIso ab heute (UTC-Mitternacht). */
function nextOccurrence(baseIso: string, today: Date): { date: string; years: number } {
  const [by, bm, bd] = baseIso.slice(0, 10).split("-").map(Number);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let year = today.getUTCFullYear();
  let candidate = Date.UTC(year, bm - 1, bd);
  if (candidate < todayUtc) {
    year += 1;
    candidate = Date.UTC(year, bm - 1, bd);
  }
  return { date: new Date(candidate).toISOString().slice(0, 10), years: year - by };
}

function daysUntil(dateIso: string, today: Date): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((Date.UTC(y, m - 1, d) - todayUtc) / MS_PER_DAY);
}

/** Jubiläen aus den Mock-Mitgliedern ableiten (Meilensteine 5/10, Horizont 365). */
function computeAnniversaries(): Anniversary[] {
  const today = new Date();
  const out: Anniversary[] = [];
  const push = (memberId: string, memberName: string, kind: AnniversaryKind, base: string, milestone: number): void => {
    const { date, years } = nextOccurrence(base, today);
    if (years <= 0 || years % milestone !== 0) return;
    const du = daysUntil(date, today);
    if (du < 0 || du > 365) return;
    out.push({ memberId, memberName, kind, date, years, daysUntil: du });
  };
  for (const m of members) {
    const name = `${m.firstName} ${m.lastName}`;
    if (m.joinedAt) push(m.id, name, "membership", m.joinedAt, 5);
    if (m.birthDate) push(m.id, name, "birthday", m.birthDate, 10);
  }
  return out.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      a.kind.localeCompare(b.kind) ||
      a.memberName.localeCompare(b.memberName, "de"),
  );
}

export const moduleRepositoryOrg: OrgRepository = {
  /* ---------- Abteilungen ---------- */
  async listDepartments(): Promise<Department[]> {
    return sortedDepartments();
  },
  async createDepartment(input): Promise<Department> {
    const now = nowIso();
    const created: Department = {
      id: `dep-local-${++depSeq}`,
      clubId,
      name: input.name,
      description: input.description,
      leadMemberId: input.leadMemberId,
      sortOrder: input.sortOrder ?? 0,
      memberIds: [],
      createdAt: now,
      updatedAt: now,
    };
    departmentStore.push(created);
    return { ...created, memberIds: [...created.memberIds] };
  },
  async updateDepartment(departmentId, patch): Promise<Department> {
    const dep = departmentStore.find((d) => d.id === departmentId);
    if (!dep) throw new Error(`Abteilung ${departmentId} nicht gefunden (mock)`);
    if (patch.name !== undefined) dep.name = patch.name;
    if (patch.description !== undefined) dep.description = patch.description ?? undefined;
    if (patch.leadMemberId !== undefined) dep.leadMemberId = patch.leadMemberId ?? undefined;
    if (patch.sortOrder !== undefined) dep.sortOrder = patch.sortOrder;
    dep.updatedAt = nowIso();
    return { ...dep, memberIds: [...dep.memberIds] };
  },
  async deleteDepartment(departmentId): Promise<{ id: string }> {
    const idx = departmentStore.findIndex((d) => d.id === departmentId);
    if (idx >= 0) departmentStore.splice(idx, 1);
    return { id: departmentId };
  },
  async setDepartmentMembers(departmentId, input): Promise<Department> {
    const dep = departmentStore.find((d) => d.id === departmentId);
    if (!dep) throw new Error(`Abteilung ${departmentId} nicht gefunden (mock)`);
    // VOLL-Replace, Duplikate entfernt — wie serverseitig (Revive per on-conflict).
    dep.memberIds = [...new Set(input.memberIds)];
    dep.updatedAt = nowIso();
    return { ...dep, memberIds: [...dep.memberIds] };
  },

  /* ---------- Schließfächer ---------- */
  async listLockers(): Promise<Locker[]> {
    return [...lockerStore]
      .sort((a, b) => a.label.localeCompare(b.label, "de"))
      .map((l) => ({ ...l }));
  },
  async createLocker(input): Promise<Locker> {
    const now = nowIso();
    const status = input.status ?? (input.assignedMemberId ? "assigned" : "free");
    const created: Locker = {
      id: `loc-local-${++locSeq}`,
      clubId,
      label: input.label,
      location: input.location,
      status,
      assignedMemberId: status === "assigned" ? input.assignedMemberId : undefined,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };
    lockerStore.push(created);
    return { ...created };
  },
  async updateLocker(lockerId, patch): Promise<Locker> {
    const loc = lockerStore.find((l) => l.id === lockerId);
    if (!loc) throw new Error(`Schließfach ${lockerId} nicht gefunden (mock)`);
    if (patch.label !== undefined) loc.label = patch.label;
    if (patch.location !== undefined) loc.location = patch.location ?? undefined;
    if (patch.status !== undefined) loc.status = patch.status;
    if (patch.assignedMemberId !== undefined) {
      loc.assignedMemberId = patch.assignedMemberId ?? undefined;
    }
    if (patch.note !== undefined) loc.note = patch.note ?? undefined;
    loc.updatedAt = nowIso();
    return { ...loc };
  },
  async deleteLocker(lockerId): Promise<{ id: string }> {
    const idx = lockerStore.findIndex((l) => l.id === lockerId);
    if (idx >= 0) lockerStore.splice(idx, 1);
    return { id: lockerId };
  },
  async assignLocker(lockerId, input): Promise<Locker> {
    const loc = lockerStore.find((l) => l.id === lockerId);
    if (!loc) throw new Error(`Schließfach ${lockerId} nicht gefunden (mock)`);
    loc.status = "assigned";
    loc.assignedMemberId = input.memberId;
    loc.updatedAt = nowIso();
    return { ...loc };
  },
  async releaseLocker(lockerId): Promise<Locker> {
    const loc = lockerStore.find((l) => l.id === lockerId);
    if (!loc) throw new Error(`Schließfach ${lockerId} nicht gefunden (mock)`);
    loc.status = "free";
    loc.assignedMemberId = undefined;
    loc.updatedAt = nowIso();
    return { ...loc };
  },

  /* ---------- Jubiläen (reine Lesesicht) ---------- */
  async getAnniversaries(): Promise<Anniversary[]> {
    return computeAnniversaries();
  },
};
