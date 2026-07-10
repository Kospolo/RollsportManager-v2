import { permissions, type AssignableRole } from "@/lib/data";
import type { Member, MemberRole } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Reine Ableitungen für „Rollen & Rechte" — kein State, keine UI. Die
 * Matrix-Zustände werden direkt aus lib/data/permissions berechnet, damit
 * Anzeige und Rechte-Mirror nie auseinanderdriften (ORIGINAL-APP-REFERENZ 1.3).
 */

/** Rollen-Reihenfolge der Matrix/Liste — Hierarchie von oben nach unten. */
export const ROLE_ORDER: MemberRole[] = [
  "owner",
  "admin",
  "moderator",
  "treasurer",
  "coach",
  "guest_coach",
  "member",
];

export type Capability = "trainer" | "clubAdmin" | "members" | "finance" | "changeRole";

export const CAPABILITIES: Capability[] = [
  "trainer",
  "clubAdmin",
  "members",
  "finance",
  "changeRole",
];

/** ✓ / – / eingeschränkt (mit Fußnote). */
export type CapState = "yes" | "no" | "partial";

/** Pill-Ton je Rolle — Status immer Farbe + Wort (Label über i18n). */
export const ROLE_TONE: Record<MemberRole, BadgeTone> = {
  owner: "brand",
  admin: "info",
  moderator: "info",
  treasurer: "info",
  coach: "success",
  guest_coach: "neutral",
  member: "neutral",
};

/**
 * Zustand einer Matrix-Zelle. Die vier Booleschen Fähigkeiten kommen 1:1 aus
 * permissions() (die Anzeige-Wahrheit); Sonderfälle:
 *  - guest_coach/Trainer = eingeschränkt (teambezogen + befristet)
 *  - Rollen ändern: owner/admin = ✓, moderator = eingeschränkt, sonst –
 * isPlatformAdmin wird bewusst auf false gesetzt (keine Session-Abhängigkeit).
 */
export function capState(role: MemberRole, capability: Capability): CapState {
  const perms = permissions({ role }, { isPlatformAdmin: false });
  switch (capability) {
    case "trainer":
      if (role === "guest_coach") return "partial";
      return perms.isTrainer ? "yes" : "no";
    case "clubAdmin":
      return perms.isClubAdmin ? "yes" : "no";
    case "members":
      return perms.canManageMembers ? "yes" : "no";
    case "finance":
      return perms.canManageFinance ? "yes" : "no";
    case "changeRole":
      if (role === "owner" || role === "admin") return "yes";
      if (role === "moderator") return "partial";
      return "no";
  }
}

/**
 * Rollen, die der aktuelle User vergeben darf (Anzeige-Gate; Server bleibt
 * Wahrheit). owner ist nie zuweisbar (Facade-Vertrag). owner/admin → alle;
 * moderator → nur rangtiefere (nicht owner/admin/moderator). Andere Rollen
 * erreichen die Auswahl nicht (Abschnitt ist dann gesperrt).
 */
export function assignableRolesFor(actingRole: MemberRole | null): AssignableRole[] {
  const base: AssignableRole[] = ["member", "coach", "guest_coach", "treasurer"];
  if (actingRole === "owner" || actingRole === "admin") return [...base, "moderator", "admin"];
  return base;
}

/** Sortiert Mitglieder nach Rollen-Hierarchie, dann Nachname/Vorname. */
export function sortByRole(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      a.lastName.localeCompare(b.lastName, "de") ||
      a.firstName.localeCompare(b.firstName, "de"),
  );
}
