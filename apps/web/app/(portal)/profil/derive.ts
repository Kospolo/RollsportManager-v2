import type { BadgeTone } from "@/components/ui/Badge";
import type { MemberRole, MemberStatus } from "@/lib/types";

/**
 * Kleine, lokale Ableitungen des Profil-Screens (Ton-Zuordnung + Alter).
 * Bewusst nicht aus dem Mitglieder-Screen importiert, um die Screens
 * entkoppelt zu halten.
 */

/** Rollen-Ton für die StatusPill im Profilkopf. */
export const ROLE_TONE: Record<MemberRole, BadgeTone> = {
  owner: "brand",
  admin: "info",
  moderator: "info",
  treasurer: "info",
  coach: "success",
  guest_coach: "neutral",
  member: "neutral",
};

/** Status-Ton für den Status-Badge. */
export const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  active: "success",
  pending: "info",
  inactive: "neutral",
  rejected: "warn",
};

/** Vollständige Jahre aus einem ISO-Geburtsdatum (lokale Zeit). */
export function ageYears(birthDateIso: string, now: Date = new Date()): number {
  const birth = new Date(birthDateIso);
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Zerlegt einen Anzeigenamen in Vor-/Nachname für den Avatar (Plattform-Persona
 * ohne Mitgliedszeile). Letztes Wort = Nachname, Rest = Vorname.
 */
export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}
