import type { ShellKey } from "@/lib/i18n/shell";
import type { IconName } from "./icons";

/** Die sechs Top-Ziele der Portal-Navigation (Sidebar + Bottom-Nav). */
export interface NavItem {
  key: ShellKey;
  href: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "navDashboard", href: "/dashboard", icon: "dashboard" },
  { key: "navEvents", href: "/termine", icon: "events" },
  { key: "navMembers", href: "/mitglieder", icon: "members" },
  { key: "navRoutines", href: "/kueren", icon: "routines" },
  { key: "navCompetition", href: "/wettkampf", icon: "competition" },
  { key: "navFinance", href: "/finanzen", icon: "finance" },
];

/**
 * Zusätzliches Nav-Ziel „Verwaltung" (Vereins-Admin-Hub). Wird NUR angehängt,
 * wenn permissions(currentUser).isClubAdmin gilt (owner/admin/moderator) —
 * siehe useVisibleNavItems(). Die Durchsetzung bleibt serverseitig.
 */
export const MANAGE_NAV_ITEM: NavItem = { key: "navManage", href: "/verwaltung", icon: "shield" };

/**
 * Nav-Ziel „Mehr" (Feature-Hub, Referenz 3.1): Übersichts-Raster aller
 * Bereiche. Für ALLE Rollen sichtbar und immer das letzte Nav-Ziel —
 * siehe useVisibleNavItems(). „dots" (•••) ist das klassische „Mehr"-Glyph.
 */
export const MORE_NAV_ITEM: NavItem = { key: "navMore", href: "/mehr", icon: "dots" };

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
