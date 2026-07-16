"use client";

import { useCapabilities } from "@/lib/capabilities";
import { MANAGE_NAV_ITEM, MORE_NAV_ITEM, NAV_ITEMS, type NavItem } from "./nav";

/**
 * Sichtbare Top-Nav-Ziele für Sidebar + Bottom-Nav: die sechs Kern-Einträge,
 * dann „Verwaltung" NUR für Vereins-Admins (owner/admin/moderator), und als
 * letztes Ziel immer „Mehr" (Feature-Hub für alle Rollen).
 *
 * ### Warum die Rollen jetzt aus der DATENBANK kommen ###
 * Vorher: `permissions(data.getCurrentUser()).isClubAdmin`. Das liest die
 * PRIMÄRROLLE (club_members.role) — und die kennt genau EINE Rolle. Seit
 * Phase 3 kann eine Person mehrere haben: wer als Zweitrolle „Administrator:in"
 * bekommt, hätte die Verwaltung im Menü NIE gesehen, obwohl der Server sie ihr
 * längst erlaubt. Das war keine Vorsicht, sondern schlicht falsch.
 * Jetzt: `roleKeys` aus GET /me/capabilities (app.member_role_keys).
 *
 * ### Die Regel ist ABSICHTLICH dieselbe geblieben ###
 * Dieselbe Rollenmenge wie bisher — {owner, admin, moderator}, wörtlich
 * CLUB_ADMIN_ROLES aus lib/data/permissions. Bewusst NICHT auf eine Fähigkeit
 * (etwa roles:manage) umgestellt: das wäre eine Bedeutungsverschiebung. Die
 * Verwaltung enthält Mitglieder, Teams, Verein und Rollen; welche Fähigkeit
 * dafür stünde, ist eine Entscheidung des Nutzers, nicht eine Nebenwirkung
 * dieses Hooks. So ändert sich für den geseedeten Bestand NICHTS — nur
 * Mehrfachrollen wirken jetzt, und der Mitgliedschafts-Gate aus 0025
 * (deleted_at/status/valid_until) greift, was der Claim nicht kann.
 *
 * Während des Ladens ist die Auflösung noch unbekannt → Verwaltung erscheint
 * erst danach (kein Flackern, kein Hydration-Mismatch: Server und erster
 * Client-Render sind identisch). Fail-closed: ohne Auflösung keine Verwaltung.
 * Der echte Schutz bleibt serverseitig (RLS + API-DB-Check).
 */

/** Wörtlich CLUB_ADMIN_ROLES aus lib/data/permissions — nur DB-aufgelöst. */
const CLUB_ADMIN_ROLE_KEYS: readonly string[] = ["owner", "admin", "moderator"];

export function useVisibleNavItems(): NavItem[] {
  const { resolution } = useCapabilities();
  const isClubAdmin = (resolution?.roleKeys ?? []).some((key) =>
    CLUB_ADMIN_ROLE_KEYS.includes(key),
  );
  const base = isClubAdmin ? [...NAV_ITEMS, MANAGE_NAV_ITEM] : NAV_ITEMS;
  return [...base, MORE_NAV_ITEM];
}
