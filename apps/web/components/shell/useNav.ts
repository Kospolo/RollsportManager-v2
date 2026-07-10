"use client";

import { permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { MANAGE_NAV_ITEM, MORE_NAV_ITEM, NAV_ITEMS, type NavItem } from "./nav";

/**
 * Sichtbare Top-Nav-Ziele für Sidebar + Bottom-Nav: die sechs Kern-Einträge,
 * dann „Verwaltung" NUR für Vereins-Admins (owner/admin/moderator), und als
 * letztes Ziel immer „Mehr" (Feature-Hub für alle Rollen).
 *
 * Die Rolle kommt aus der Facade (data.getCurrentUser()); permissions() bildet
 * daraus die reine Anzeige-Sichtbarkeit ab (Referenz 1.3). Während des Ladens
 * ist die Rolle noch unbekannt → Verwaltung erscheint erst danach (kein
 * Flackern, kein Hydration-Mismatch, da Server und erster Client-Render
 * identisch sind). Der echte Schutz bleibt serverseitig (RLS + API-DB-Check).
 */
export function useVisibleNavItems(): NavItem[] {
  const me = useData((repo) => repo.getCurrentUser());
  const isClubAdmin = permissions(me.data ?? null).isClubAdmin;
  const base = isClubAdmin ? [...NAV_ITEMS, MANAGE_NAV_ITEM] : NAV_ITEMS;
  return [...base, MORE_NAV_ITEM];
}
