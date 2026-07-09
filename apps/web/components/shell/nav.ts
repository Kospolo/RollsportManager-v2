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

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
