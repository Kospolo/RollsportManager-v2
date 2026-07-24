import * as mock from "@/lib/mock";
import type {
  Budget,
  BudgetReport,
  BudgetReportRow,
  ChildCreated,
  Guardianship,
  UploadMyPhotoResult,
  WaitlistEntry,
} from "@/lib/types";
import type { Cluster6aRepository } from "../inputs-cluster6a";
import { ledgerCategorySeed, legacyCategoryMap } from "./seed-finance";

/**
 * Mock-Implementierung des Cluster 6a (Wartelisten, Budgetplanung,
 * Familie-Selfservice, Profilfoto). Eigene In-Memory-Stores (Session-Dauer),
 * kein echter Rechtecheck — die Wahrheit ist im api-Modus der Server (RLS).
 *
 * Der Budget-Bericht wird zur Laufzeit aus dem Budget-Store (Plan) und
 * mock.ledger (Ist) berechnet, damit Soll-Ist-Varianz plausibel wirkt.
 */

const clubId = mock.club.id;
// `let` + Melderegister: Auf der Beta wechselt /entwickler die eingeloggte
// Person. Eine Kopie beim Laden des Moduls bekäme davon nichts mit — hier
// hängen Erziehungsberechtigten-Zuordnungen und Foto-Uploads dran, die dann
// der falschen Person zugeschrieben würden.
let self = mock.currentUser;
mock.onViewerChange(() => {
  self = mock.currentUser;
});
const nowIso = (): string => new Date().toISOString();
const thisYear = new Date().getFullYear();

/** Demo-Avatar als CSP-sichere Inline-SVG-Data-URI (kein externer Request). */
function demoAvatar(hue: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},68%,58%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue + 38},64%,42%)"/></linearGradient></defs>` +
    `<rect width="128" height="128" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ---------- Wartelisten-Store (plausible Startbelegung) ---------- */

const waitlistStore: WaitlistEntry[] = [
  {
    id: "wl-01",
    clubId,
    memberId: self.id,
    kind: "team",
    targetId: "t-03",
    note: "Wechsel in die Kürgruppe gewünscht",
    status: "waiting",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "wl-02",
    clubId,
    memberId: "m-20",
    kind: "facility",
    note: "Zusätzliche Hallenzeit Freitag",
    status: "offered",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];
let waitlistSeq = waitlistStore.length;

/* ---------- Budget-Store (plausible Planzeilen fürs laufende Jahr) ---------- */

const budgetStore: Budget[] = [
  { categoryId: "cat-01", plannedCents: 1_800_000 },
  { categoryId: "cat-02", plannedCents: 250_000 },
  { categoryId: "cat-03", plannedCents: 900_000 },
  { categoryId: "cat-04", plannedCents: 180_000 },
  { categoryId: "cat-05", plannedCents: 120_000 },
].map((r, i) => ({
  id: `bud-${String(i + 1).padStart(2, "0")}`,
  clubId,
  year: thisYear,
  categoryId: r.categoryId,
  plannedCents: r.plannedCents,
  note: undefined,
  createdAt: nowIso(),
  updatedAt: nowIso(),
}));
let budgetSeq = budgetStore.length;
let guardianshipSeq = mock.guardianships.length;
let childSeq = 0;

/** Ist-Beträge je Kategorie (Betrag positiv) aus mock.ledger für das Jahr. */
function actualByCategory(year: number): Map<string, number> {
  const acc = new Map<string, number>();
  if (year !== thisYear) return acc; // Nur fürs laufende Jahr liegen Ist-Daten vor.
  for (const entry of mock.ledger) {
    const catId = legacyCategoryMap[entry.category];
    if (!catId) continue;
    acc.set(catId, (acc.get(catId) ?? 0) + Math.abs(entry.amountCents));
  }
  return acc;
}

export const moduleRepositoryCluster6a: Cluster6aRepository = {
  /* ---------- Familie ---------- */
  async createChild(input): Promise<ChildCreated> {
    const childId = `m-child-${++childSeq}`;
    const guardianId = input.guardianMemberId ?? self.id;
    const child = {
      id: childId,
      clubId,
      firstName: input.firstName,
      lastName: input.lastName,
      role: "member" as const,
      status: "active" as const,
      birthDate: input.birthDate,
      teamIds: [],
      joinedAt: input.joinedOn ?? nowIso().slice(0, 10),
    };
    const guardianship: Guardianship = {
      id: `g-local-${++guardianshipSeq}`,
      guardianId,
      childId,
      relation: input.relation === "parent" ? "parent" : "other",
    };
    return { child, guardianship };
  },
  async addGuardianship(input): Promise<Guardianship> {
    return {
      id: `g-local-${++guardianshipSeq}`,
      guardianId: input.guardianMemberId ?? self.id,
      childId: input.childMemberId,
      relation: input.relation === "parent" ? "parent" : "other",
    };
  },
  async removeGuardianship(guardianshipId) {
    return { id: guardianshipId };
  },

  /* ---------- Wartelisten ---------- */
  async listWaitlists(kind) {
    // Mock spiegelt die Trainer-Sicht (ganze Queue); im api-Modus scoped die RLS.
    const rows = kind ? waitlistStore.filter((w) => w.kind === kind) : waitlistStore;
    return rows.map((w) => ({ ...w }));
  },
  async joinWaitlist(input): Promise<WaitlistEntry> {
    const created: WaitlistEntry = {
      id: `wl-local-${++waitlistSeq}`,
      clubId,
      memberId: input.memberId,
      kind: input.kind,
      targetId: input.targetId,
      note: input.note,
      status: "waiting",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    waitlistStore.push(created);
    return { ...created };
  },
  async updateWaitlist(waitlistId, patch): Promise<WaitlistEntry> {
    const entry = waitlistStore.find((w) => w.id === waitlistId);
    if (!entry) throw new Error(`Wartelisten-Eintrag ${waitlistId} nicht gefunden (mock)`);
    if (patch.status !== undefined) entry.status = patch.status;
    if (patch.note !== undefined) entry.note = patch.note ?? undefined;
    entry.updatedAt = nowIso();
    return { ...entry };
  },
  async leaveWaitlist(waitlistId) {
    const idx = waitlistStore.findIndex((w) => w.id === waitlistId);
    if (idx >= 0) waitlistStore.splice(idx, 1);
    return { id: waitlistId };
  },

  /* ---------- Budget ---------- */
  async listBudgets(year) {
    return budgetStore.filter((b) => b.year === year).map((b) => ({ ...b }));
  },
  async upsertBudget(input): Promise<Budget> {
    // id gesetzt ODER bestehende Zeile für Jahr/Kategorie → ändern; sonst neu.
    const existing = input.id
      ? budgetStore.find((b) => b.id === input.id)
      : budgetStore.find((b) => b.year === input.year && b.categoryId === input.categoryId);
    if (existing) {
      if (input.plannedCents !== null) existing.plannedCents = input.plannedCents;
      if (input.note !== undefined) existing.note = input.note ?? undefined;
      existing.updatedAt = nowIso();
      return { ...existing };
    }
    const created: Budget = {
      id: `bud-local-${++budgetSeq}`,
      clubId,
      year: input.year,
      categoryId: input.categoryId,
      plannedCents: input.plannedCents ?? 0,
      note: input.note ?? undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    budgetStore.push(created);
    return { ...created };
  },
  async deleteBudget(budgetId) {
    const idx = budgetStore.findIndex((b) => b.id === budgetId);
    if (idx >= 0) budgetStore.splice(idx, 1);
    return { id: budgetId };
  },
  async getBudgetReport(year): Promise<BudgetReport> {
    const actuals = actualByCategory(year);
    const planned = new Map(
      budgetStore.filter((b) => b.year === year).map((b) => [b.categoryId, b.plannedCents]),
    );
    const rows: BudgetReportRow[] = ledgerCategorySeed.map((cat) => {
      const plannedCents = planned.get(cat.id) ?? 0;
      const actualCents = actuals.get(cat.id) ?? 0;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        kind: cat.kind,
        plannedCents,
        actualCents,
        varianceCents: plannedCents - actualCents,
      };
    });
    return {
      clubId,
      year,
      rows,
      plannedTotalCents: rows.reduce((s, r) => s + r.plannedCents, 0),
      actualTotalCents: rows.reduce((s, r) => s + r.actualCents, 0),
      varianceTotalCents: rows.reduce((s, r) => s + r.varianceCents, 0),
    };
  },

  /* ---------- Profilfoto ---------- */
  async uploadMyPhoto(): Promise<UploadMyPhotoResult> {
    // Plausibler Demo-Avatar (Inline-SVG-Data-URI); im api-Modus echtes multipart.
    const avatarUrl = demoAvatar(268);
    return {
      avatarKey: `avatars/${self.id}/${Date.now()}.svg`,
      avatarUrl,
      updatedMemberIds: [self.id],
    };
  },
};
