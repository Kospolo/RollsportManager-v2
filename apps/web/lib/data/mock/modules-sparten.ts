import { club } from "@/lib/mock";
import type { Sparte } from "@/lib/types";
import type { SpartenRepository } from "../inputs-sparten";
import { sparteSeed } from "./seed-sparten";

/**
 * Mock-Implementierung der Sparten (Migration 0062–0064). Eigener In-Memory-
 * Store (Session-Lebensdauer), kein echter Rechtecheck — die Wahrheit ist im
 * api-Modus der Server. `setTeamSparte` lebt bewusst in mock/index.ts, weil es
 * den dortigen teamStore mutiert; hier sind nur die Sparten-eigenen Pfade.
 */

const clubId = club.id;

const nowIso = (): string => new Date().toISOString();

const sparteStore: Sparte[] = sparteSeed.map((s) => ({ ...s, memberIds: [...s.memberIds] }));

let spSeq = sparteStore.length;

const clone = (s: Sparte): Sparte => ({ ...s, memberIds: [...s.memberIds] });

/** Nach (sortOrder, name) sortieren — wie serverseitig geliefert. */
function sortedSparten(): Sparte[] {
  return [...sparteStore]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"))
    .map(clone);
}

export const moduleRepositorySparten: Omit<SpartenRepository, "setTeamSparte"> = {
  async getSparten(): Promise<Sparte[]> {
    return sortedSparten();
  },
  async createSparte(input): Promise<Sparte> {
    const now = nowIso();
    const created: Sparte = {
      id: `sp-local-${++spSeq}`,
      clubId,
      name: input.name,
      icon: input.icon ?? undefined,
      color: input.color ?? undefined,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      ownFinances: input.ownFinances ?? false,
      memberIds: [],
      createdAt: now,
      updatedAt: now,
    };
    sparteStore.push(created);
    return clone(created);
  },
  async updateSparte(sparteId, patch): Promise<Sparte> {
    const sp = sparteStore.find((s) => s.id === sparteId);
    if (!sp) throw new Error(`Sparte ${sparteId} nicht gefunden (mock)`);
    if (patch.name !== undefined) sp.name = patch.name;
    if (patch.icon !== undefined) sp.icon = patch.icon ?? undefined;
    if (patch.color !== undefined) sp.color = patch.color ?? undefined;
    if (patch.active !== undefined) sp.active = patch.active;
    if (patch.sortOrder !== undefined) sp.sortOrder = patch.sortOrder;
    if (patch.ownFinances !== undefined) sp.ownFinances = patch.ownFinances;
    sp.updatedAt = nowIso();
    return clone(sp);
  },
  async deleteSparte(sparteId): Promise<{ id: string }> {
    const idx = sparteStore.findIndex((s) => s.id === sparteId);
    if (idx >= 0) sparteStore.splice(idx, 1);
    return { id: sparteId };
  },
  async setSparteMembers(sparteId, memberIds): Promise<Sparte> {
    const sp = sparteStore.find((s) => s.id === sparteId);
    if (!sp) throw new Error(`Sparte ${sparteId} nicht gefunden (mock)`);
    // VOLL-Replace, Duplikate entfernt — wie serverseitig (Revive per on-conflict).
    sp.memberIds = [...new Set(memberIds)];
    sp.updatedAt = nowIso();
    return clone(sp);
  },
};
