import type { AssignableRole } from "@/lib/data";
import type { BadgeTone } from "@/components/ui/Badge";
import type { Member, MemberRole, MemberStatus, Team } from "@/lib/types";

/**
 * Reine Ableitungen für die Mitglieder-Verwaltung — kein State, keine UI.
 * Filter, Töne und die Auswahllisten werden hier zentral gehalten, damit
 * Tabelle und Bearbeiten-Sheet dieselbe Wahrheit nutzen.
 */

/* ---------- Rollen-Filter ---------- */

export type RoleFilter = "all" | "board" | "moderator" | "treasurer" | "coach" | "member" | "guest";

const ROLE_FILTER_MATCH: Record<Exclude<RoleFilter, "all">, MemberRole[]> = {
  board: ["owner", "admin"],
  moderator: ["moderator"],
  treasurer: ["treasurer"],
  coach: ["coach"],
  member: ["member"],
  guest: ["guest_coach"],
};

export const ROLE_FILTERS: RoleFilter[] = [
  "all",
  "board",
  "moderator",
  "treasurer",
  "coach",
  "member",
  "guest",
];

export function matchesRoleFilter(member: Member, filter: RoleFilter): boolean {
  if (filter === "all") return true;
  return ROLE_FILTER_MATCH[filter].includes(member.role);
}

/* ---------- Status-Filter ---------- */

export type StatusFilter = "all" | MemberStatus;

// "rejected" gehoert in die Liste, seit 0037 eine Ablehnung ein Gedaechtnis
// hat (vorher: Soft-Delete, der Vorgang war weg). Ohne den Filter waere die
// abgelehnte Person zwar gespeichert, aber fuer den Vorstand unauffindbar —
// und genau das Vergessen sollte 0037 beenden.
export const STATUS_FILTERS: StatusFilter[] = ["all", "active", "inactive", "pending", "rejected"];

export function matchesStatusFilter(member: Member, filter: StatusFilter): boolean {
  return filter === "all" || member.status === filter;
}

/* ---------- Töne (Status immer Farbe + Wort) ---------- */

export const ROLE_TONE: Record<MemberRole, BadgeTone> = {
  owner: "brand",
  admin: "info",
  moderator: "info",
  treasurer: "info",
  coach: "success",
  guest_coach: "neutral",
  member: "neutral",
};

export const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  active: "success",
  pending: "info",
  inactive: "neutral",
  rejected: "warn",
};

/* ---------- Auswahllisten für das Sheet ---------- */

/**
 * Zuweisbare Rollen (owner ist nie per PATCH vergebbar). Reihenfolge von
 * ranghoch nach rangtief; die Anzeige graut einzelne Optionen aus, sobald die
 * Rolle des aktuellen Users sie nicht vergeben darf (permissions.canChangeRole).
 */
export const ASSIGNABLE_ROLES: AssignableRole[] = [
  "admin",
  "moderator",
  "treasurer",
  "coach",
  "member",
  "guest_coach",
];

/** Manuell setzbare Status — „pending" ist ein System-Zustand aus der Einladung. */
export const STATUS_OPTIONS: MemberStatus[] = ["active", "inactive"];

/* ---------- Hilfen ---------- */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function teamNames(member: Member, teams: Team[]): string[] {
  return member.teamIds
    .map((id) => teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function sortMembers(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de"),
  );
}
