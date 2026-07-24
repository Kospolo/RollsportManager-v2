import { club, guardianships, members } from "@/lib/mock";
import type {
  Anniversary,
  AnniversaryKind,
  Department,
  Locker,
  LockerRental,
  MemberRole,
} from "@/lib/types";
import type { OrgRepository } from "../inputs-org";
import { departmentSeed, lockerRentalSeed, lockerSeed } from "./seed-org";
import { mockViewer } from "./viewer";

/**
 * Mock-Implementierung der Organisations-Module (Abteilungen, Schließfächer,
 * Jubiläen). Eigene In-Memory-Stores (Session-Lebensdauer). Jubiläen werden zur
 * Laufzeit aus den Mock-Mitgliedern berechnet (Horizont 365 Tage).
 *
 * SCHREIBRECHTE werden hier NICHT nachgebaut — die Wahrheit ist im api-Modus
 * der Server. Bei den SCHLIESSFÄCHERN und ihren MIETVERTRÄGEN wird die
 * LESE-Regel aber sehr wohl gespiegelt (lockers_select / locker_rentals_select,
 * 0070): sonst zeigte die Demo einem Mitglied die Fächer und Mietpreise aller
 * anderen — also genau das, was die RLS verhindert, und niemandem fiele es auf,
 * bis es echt ist. Wer der Betrachter ist, entscheidet der Demo-Umschalter
 * (viewer.ts).
 */

const clubId = club.id;

const nowIso = (): string => new Date().toISOString();

/** Heute als ISO-Datum (YYYY-MM-DD) — Vorbelegung für Miet-Beginn/-Ende. */
const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Fächer + Verträge verwalten und ALLE sehen: owner/admin/treasurer (0070). */
const LOCKER_MANAGE_ROLES: readonly MemberRole[] = ["owner", "admin", "treasurer"];

const departmentStore: Department[] = departmentSeed.map((d) => ({
  ...d,
  memberIds: [...d.memberIds],
}));
const lockerStore: Locker[] = lockerSeed.map((l) => ({ ...l }));
const rentalStore: LockerRental[] = lockerRentalSeed.map((r) => ({ ...r }));

let depSeq = departmentStore.length;
let locSeq = lockerStore.length;
let rentSeq = rentalStore.length;

/** Sieht die Betrachter-Persona alle Fächer/Verträge — oder nur ihre eigenen? */
function viewerManagesLockers(): boolean {
  return LOCKER_MANAGE_ROLES.includes(mockViewer().role);
}

/**
 * Spiegelt app.locker_has_active_rental: das Flag wird IMMER aus dem
 * vollständigen Vertrags-Store gerechnet, nie aus der (RLS-gekürzten) Liste,
 * die die Betrachterin zu sehen bekommt. Sonst hielte ein Mitglied ein fremdes,
 * längst vermietetes Fach für frei.
 */
function hasActiveRental(lockerId: string): boolean {
  return rentalStore.some((r) => r.lockerId === lockerId && r.status === "aktiv");
}

/** Fach-Kopie mit frisch gerechnetem hasActiveRental. */
function lockerView(locker: Locker): Locker {
  return { ...locker, hasActiveRental: hasActiveRental(locker.id) };
}

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
    // Lese-Regel gespiegelt (lockers_select): Verwaltung sieht alle Fächer,
    // alle anderen NUR ihr eigenes — zugeordnet ODER gemietet. Ohne diese
    // Kürzung liefe die Mitglieds-Ansicht in der Demo nie durch den Zustand,
    // für den sie gebaut ist.
    const viewer = mockViewer();
    const all = viewerManagesLockers();
    return [...lockerStore]
      .filter(
        (l) =>
          all ||
          l.assignedMemberId === viewer.id ||
          rentalStore.some(
            (r) => r.lockerId === l.id && r.memberId === viewer.id && r.status === "aktiv",
          ),
      )
      .sort((a, b) => a.label.localeCompare(b.label, "de"))
      .map(lockerView);
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
      size: input.size ?? "mittel",
      // ?? null statt ?? 0: „nicht angegeben" heißt „kein Preis festgelegt",
      // nicht „kostenlos".
      pricePerMonthCents: input.pricePerMonthCents ?? null,
      hasActiveRental: false,
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
    if (patch.size !== undefined) loc.size = patch.size;
    // Hier bleibt null erhalten (kein ?? undefined): der Preis wird auf
    // „nicht festgelegt" zurückgesetzt, nicht auf 0.
    if (patch.pricePerMonthCents !== undefined) {
      loc.pricePerMonthCents = patch.pricePerMonthCents;
    }
    if (patch.assignedMemberId !== undefined) {
      loc.assignedMemberId = patch.assignedMemberId ?? undefined;
    }
    if (patch.note !== undefined) loc.note = patch.note ?? undefined;
    loc.updatedAt = nowIso();
    return lockerView(loc);
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
    return lockerView(loc);
  },
  async releaseLocker(lockerId): Promise<Locker> {
    const loc = lockerStore.find((l) => l.id === lockerId);
    if (!loc) throw new Error(`Schließfach ${lockerId} nicht gefunden (mock)`);
    loc.status = "free";
    loc.assignedMemberId = undefined;
    loc.updatedAt = nowIso();
    // Der Mietvertrag bleibt BEWUSST unangetastet: „Fach freigeben" ist eine
    // Schlüssel-Aussage, „Miete beenden" eine Geld-Aussage. Der Server macht
    // daraus ebenfalls keine Automatik (v1-Regel, in 99pB gemessen) — würde
    // der Mock hier stillschweigend kündigen, entstünde in der Demo ein
    // Verhalten, das es nicht gibt.
    return lockerView(loc);
  },

  /* ---------- Vermietung (0070) ---------- */
  async listLockerRentals(filter): Promise<LockerRental[]> {
    // locker_rentals_select gespiegelt: Verwaltung alles, sonst nur eigene
    // bzw. die des eigenen Kindes. Eine Miete ist eine Zahlungspflicht — wer
    // zahlt, muss sie sehen; wer nicht zahlt, hat sie nicht zu sehen.
    const viewer = mockViewer();
    const all = viewerManagesLockers();
    const ownIds = new Set<string>([viewer.id]);
    for (const g of guardianships) {
      if (g.guardianId === viewer.id) ownIds.add(g.childId);
    }
    return rentalStore
      .filter((r) => all || ownIds.has(r.memberId))
      .filter((r) => (filter?.memberId ? r.memberId === filter.memberId : true))
      .filter((r) => (filter?.lockerId ? r.lockerId === filter.lockerId : true))
      .filter((r) => (filter?.status ? r.status === filter.status : true))
      .sort((a, b) => b.startOn.localeCompare(a.startOn))
      .map((r) => ({ ...r }));
  },
  async createLockerRental(input): Promise<LockerRental> {
    // Teilindex „ein aktiver Vertrag je Fach" nachgebildet — im api-Modus ein
    // sprechendes 409, hier dieselbe Aussage als Fehler.
    const status = input.status ?? "aktiv";
    if (
      status === "aktiv" &&
      rentalStore.some((r) => r.lockerId === input.lockerId && r.status === "aktiv")
    ) {
      throw new Error(
        "Dieses Fach ist bereits vermietet — die laufende Vermietung zuerst beenden (mock)",
      );
    }
    const now = nowIso();
    const created: LockerRental = {
      id: `lrent-local-${++rentSeq}`,
      clubId,
      lockerId: input.lockerId,
      memberId: input.memberId,
      pricePerMonthCents: input.pricePerMonthCents ?? null,
      startOn: input.startOn || todayIso(),
      endOn: input.endOn ?? null,
      status,
      note: input.note ?? undefined,
      createdAt: now,
      updatedAt: now,
    };
    rentalStore.unshift(created);
    return { ...created };
  },
  async updateLockerRental(rentalId, patch): Promise<LockerRental> {
    const rental = rentalStore.find((r) => r.id === rentalId);
    if (!rental) throw new Error(`Vermietung ${rentalId} nicht gefunden (mock)`);
    if (
      patch.status === "aktiv" &&
      rental.status !== "aktiv" &&
      rentalStore.some(
        (r) => r.lockerId === rental.lockerId && r.status === "aktiv" && r.id !== rentalId,
      )
    ) {
      throw new Error("Dieses Fach hat bereits eine andere laufende Vermietung (mock)");
    }
    if (patch.pricePerMonthCents !== undefined) {
      rental.pricePerMonthCents = patch.pricePerMonthCents;
    }
    if (patch.startOn !== undefined) rental.startOn = patch.startOn;
    if (patch.endOn !== undefined) rental.endOn = patch.endOn;
    if (patch.status !== undefined) rental.status = patch.status;
    if (patch.note !== undefined) rental.note = patch.note ?? undefined;
    rental.updatedAt = nowIso();
    return { ...rental };
  },
  async deleteLockerRental(rentalId): Promise<{ id: string }> {
    const idx = rentalStore.findIndex((r) => r.id === rentalId);
    if (idx >= 0) rentalStore.splice(idx, 1);
    return { id: rentalId };
  },

  /* ---------- Jubiläen (reine Lesesicht) ---------- */
  async getAnniversaries(): Promise<Anniversary[]> {
    return computeAnniversaries();
  },
};
