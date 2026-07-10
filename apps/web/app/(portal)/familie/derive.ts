import { isNotImplemented, memberById } from "@/lib/data";
import type {
  DunningLevel,
  Guardianship,
  Invoice,
  Member,
  Team,
} from "@/lib/types";

/**
 * Reine Ableitungs-Helfer für den Familien-Screen — arbeiten ausschließlich
 * auf den per Facade (lib/data) geladenen Arrays, damit Mock- und api-Modus
 * identisch rechnen. Bewusst self-contained (kein Import aus fremden
 * Routen-Ordnern), Team-eigene Kopie der kleinen Familien-/Beitrags-Logik.
 */

/* ---------- NotImplemented-Weichzeichner ---------- */

/**
 * Für Nebendaten eines Screens (Teams, Rechnungen): eine bekannte
 * Contract-Lücke (NotImplementedError) wird zu `null` — der Screen rendert
 * dafür einen sichtbaren Hinweis, NIE ein vorgetäuschtes leeres Array.
 * Alle anderen Fehler laufen normal weiter (Fehlerzustand mit Retry).
 */
export async function softNotImplemented<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (isNotImplemented(error)) return null;
    throw error;
  }
}

/* ---------- Familien-Verknüpfungen ---------- */

export type FamilyLink = { member: Member; relation: Guardianship["relation"] };

/** Kinder der Person (die Person ist Erziehungsberechtigte:r). */
export function childrenOf(
  personId: string,
  guardianships: Guardianship[],
  members: Member[],
): FamilyLink[] {
  return guardianships
    .filter((g) => g.guardianId === personId)
    .map((g) => ({ member: memberById(members, g.childId), relation: g.relation }))
    .filter((link): link is FamilyLink => Boolean(link.member));
}

/** Erziehungsberechtigte der Person (die Person ist Kind). */
export function guardiansOf(
  personId: string,
  guardianships: Guardianship[],
  members: Member[],
): FamilyLink[] {
  return guardianships
    .filter((g) => g.childId === personId)
    .map((g) => ({ member: memberById(members, g.guardianId), relation: g.relation }))
    .filter((link): link is FamilyLink => Boolean(link.member));
}

/* ---------- Teams ---------- */

export function teamNames(member: Member, teams: Team[]): string[] {
  return member.teamIds
    .map((id) => teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

/* ---------- Beitragsstatus (Ampel) ---------- */

export type DuesStatus =
  | { kind: "exempt" }
  | { kind: "paid" }
  | { kind: "open"; level: DunningLevel };

/**
 * Beitragsstatus eines Familienmitglieds. Nur echte Mitglieder (role
 * "member") haben Beiträge; Trainer:innen/Vorstand sind befreit. Kinder
 * spiegeln die Familie: verantwortlich sind sie selbst PLUS ihre
 * Erziehungsberechtigten — offene Posten dort zählen mit (Familienmodell).
 */
export function duesStatus(
  member: Member,
  invoices: Invoice[],
  guardianships: Guardianship[],
): DuesStatus {
  if (member.role !== "member") return { kind: "exempt" };
  const responsibleIds = [
    member.id,
    ...guardianships.filter((g) => g.childId === member.id).map((g) => g.guardianId),
  ];
  const open = invoices.filter(
    (invoice) => invoice.status === "open" && responsibleIds.includes(invoice.memberId),
  );
  if (open.length === 0) return { kind: "paid" };
  const level = Math.max(...open.map((invoice) => invoice.dunningLevel)) as DunningLevel;
  return { kind: "open", level };
}
