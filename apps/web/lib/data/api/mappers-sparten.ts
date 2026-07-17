import type * as M from "@/lib/api/generated";
import type { Sparte } from "@/lib/types";

/**
 * Mapper der Sparten (Migration 0062–0064): API-Wire-Format (snake_case, DE-
 * Feldnamen wie farbe/sortierung/eigene_finanzen) → View-Typ (camelCase,
 * lib/types-sparten).
 */
export function mapSparte(w: M.Sparte): Sparte {
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    icon: w.icon ?? undefined,
    color: w.farbe ?? undefined,
    active: w.aktiv,
    sortOrder: w.sortierung,
    ownFinances: w.eigene_finanzen,
    memberIds: [...w.member_ids],
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}
