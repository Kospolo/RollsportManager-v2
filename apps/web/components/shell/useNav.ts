"use client";

import type { ShellKey } from "@/lib/i18n/shell";
import { permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { upcomingEvents } from "@/lib/mock";
import { useCapabilities } from "@/lib/capabilities";
import { useModules } from "@/lib/modules";
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
  // BETREIBER-EINSICHT: ein Plattform-Admin hat in KEINEM Verein eine Rolle —
  // roleKeys ist für ihn immer leer, denn die Autorität kommt nicht aus
  // app.member_roles, sondern aus dem Claim (den GET /me/capabilities hier als
  // isPlatformAdmin ausdrücklich mitliefert). Ohne diese Zeile blieb ihm die
  // Verwaltung verborgen, obwohl der Server sie ihm seit 0051 erlaubt — und die
  // Betreiber-Konsole verweist ihn für Rollen/Module ausdrücklich DORTHIN.
  // Fail-closed bleibt es trotzdem: ohne Auflösung keine Verwaltung, und der
  // Schutz ist ohnehin der Server (RLS + API-DB-Check).
  const isOperator = resolution?.isPlatformAdmin === true;

  // MODUL-SCHALTER (0061): hat der Verein „Finanzen" abgeschaltet, verschwindet
  // das Nav-Ziel „Finanzen" — der Nutzer war klar: dann „in keinem bereich was
  // mit finanzen/rechnungen anzeigen". Ausblenden, NICHT 403: der Server ist
  // ohnehin dicht (RLS-Gates + Service-Mode-Checks). Fail-open beim Laden.
  // 0077: `isModuleVisible` statt `isModuleAvailable`. `available` beantwortet
  // nur „hat der VEREIN das Modul?" — dem Mitglied stand „Finanzen" deshalb
  // weiter in der Leiste, obwohl es ihm nicht angeboten werden soll. Der
  // Modul-Schalter des Vereins wirkt unverändert mit: die personenbezogene
  // Liste enthält ohnehin nur, was gekauft UND eingeschaltet ist.
  const { isModuleVisible } = useModules();
  const items = NAV_ITEMS.filter(
    (item) => item.href !== "/finanzen" || isModuleVisible("finance"),
  );

  const base = isClubAdmin || isOperator ? [...items, MANAGE_NAV_ITEM] : items;
  return [...base, MORE_NAV_ITEM];
}

/**
 * Anzahl wartender Wartelisten-Einträge (status === "waiting") — NUR für
 * Trainer+ (permissions(self).isTrainer, wie im Wartelisten-Screen). Quelle ist
 * die Facade (repo.listWaitlists); die RLS liefert Trainer:innen die ganze
 * Queue. Nicht-Trainer und Ladefehler (z. B. NotImplemented im api-Modus) → 0,
 * dann zeigt der Aufrufer kein Badge.
 */
export function useWaitlistWaitingCount(): number {
  const me = useData((repo) => repo.getCurrentUser());
  const waitlists = useData((repo) => repo.listWaitlists());
  if (!permissions(me.data ?? null).isTrainer) return 0;
  return (waitlists.data ?? []).filter((entry) => entry.status === "waiting").length;
}

/**
 * Zähler-Badges der Top-Nav — dasselbe Muster wie das bestehende Termine-Badge,
 * jetzt zentral und um die Warteliste erweitert:
 *   • navEvents → anstehende Termine (7 Tage), unverändert (upcomingEvents)
 *   • navMore   → wartende Wartelisten-Einträge (Trainer+); Wartelisten sind
 *                 über „Mehr" erreichbar. 0 → kein Badge.
 * Sidebar und Bottom-Nav rendern die Zahl generisch pro Nav-Ziel.
 */
export function useNavBadges(): Partial<Record<ShellKey, number>> {
  const waitlistWaiting = useWaitlistWaitingCount();
  return {
    navEvents: upcomingEvents(7).length,
    navMore: waitlistWaiting,
  };
}
