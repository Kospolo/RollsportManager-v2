import { isNotImplemented, memberById } from "@/lib/data";
import type { BadgeTone } from "@/components/ui/Badge";
import type {
  Attendance,
  DunningLevel,
  Event,
  Guardianship,
  Invoice,
  Member,
  MemberRole,
  Team,
} from "@/lib/types";

/**
 * Abgeleitete Sichten für den Mitglieder-Bereich — REINE Funktionen über
 * den per Facade (lib/data) geladenen Arrays. Kein lib/mock-Import mehr;
 * alle Summen/Status werden hier berechnet, nie hart codiert.
 */

/* ---------- NotImplemented-Weichzeichner ---------- */

/**
 * Für Nebendaten eines Screens (z. B. Teams-Spalte in der Liste): eine
 * bekannte Contract-Lücke (NotImplementedError) wird zu `null` — der Screen
 * rendert dafür einen sichtbaren Hinweis („nicht angebunden"), NIE ein
 * vorgetäuschtes leeres Array. Alle anderen Fehler laufen normal weiter
 * (Fehlerzustand mit Retry).
 */
export async function softNotImplemented<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (isNotImplemented(error)) return null;
    throw error;
  }
}

/* ---------- Rollen ---------- */

export type RoleFilter = "all" | "board" | "treasurer" | "coach" | "member" | "guest";

const FILTER_ROLES: Record<Exclude<RoleFilter, "all">, MemberRole[]> = {
  board: ["owner", "admin"],
  treasurer: ["treasurer"],
  coach: ["coach"],
  member: ["member"],
  guest: ["guest_coach"],
};

export function matchesRoleFilter(member: Member, filter: RoleFilter): boolean {
  if (filter === "all") return true;
  return FILTER_ROLES[filter].includes(member.role);
}

/** Pill-Ton je Rolle — Status immer Farbe + Wort (Label via roleKey aus i18n). */
export const ROLE_TONE: Record<MemberRole, BadgeTone> = {
  owner: "brand",
  admin: "info",
  moderator: "info",
  treasurer: "info",
  coach: "success",
  guest_coach: "neutral",
  member: "neutral",
};

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
  | { kind: "open"; level: DunningLevel; openCents: number };

/**
 * Beitragsstatus eines Mitglieds. Kinder haben selbst keine Rechnungen —
 * verantwortlich sind sie selbst PLUS ihre Erziehungsberechtigten
 * (Familienmodell: die Ampel des Kindes spiegelt die Familie).
 *
 * `guardianships === null` bedeutet: Familien-Daten sind in der aktiven
 * Datenquelle nicht angebunden — dann zählen nur eigene Rechnungen
 * (der Screen zeigt dazu einen Hinweis).
 */
export function duesStatus(
  member: Member,
  invoices: Invoice[],
  guardianships: Guardianship[] | null,
): DuesStatus {
  if (member.role !== "member") return { kind: "exempt" };
  const responsibleIds = [
    member.id,
    ...(guardianships ?? []).filter((g) => g.childId === member.id).map((g) => g.guardianId),
  ];
  const open = invoices.filter(
    (invoice) => invoice.status === "open" && responsibleIds.includes(invoice.memberId),
  );
  if (open.length === 0) return { kind: "paid" };
  const level = Math.max(...open.map((invoice) => invoice.dunningLevel)) as DunningLevel;
  return {
    kind: "open",
    level,
    openCents: open.reduce((sum, invoice) => sum + invoice.amountCents, 0),
  };
}

/* ---------- Familie ---------- */

export type FamilyLink = { member: Member; relation: Guardianship["relation"] };

export function guardiansOf(
  memberId: string,
  guardianships: Guardianship[],
  members: Member[],
): FamilyLink[] {
  return guardianships
    .filter((g) => g.childId === memberId)
    .map((g) => ({ member: memberById(members, g.guardianId), relation: g.relation }))
    .filter((link): link is FamilyLink => Boolean(link.member));
}

export function childrenOf(
  memberId: string,
  guardianships: Guardianship[],
  members: Member[],
): FamilyLink[] {
  return guardianships
    .filter((g) => g.guardianId === memberId)
    .map((g) => ({ member: memberById(members, g.childId), relation: g.relation }))
    .filter((link): link is FamilyLink => Boolean(link.member));
}

/* ---------- Beitrags-Historie ---------- */

export function invoicesOf(memberId: string, invoices: Invoice[]): Invoice[] {
  return invoices
    .filter((invoice) => invoice.memberId === memberId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export function openSumCentsOf(memberId: string, invoices: Invoice[]): number {
  return invoicesOf(memberId, invoices)
    .filter((invoice) => invoice.status === "open")
    .reduce((sum, invoice) => sum + invoice.amountCents, 0);
}

/* ---------- Anwesenheit ---------- */

export type AttendanceStats = {
  /** Betrachtete Trainingseinheiten (max. 8) */
  total: number;
  present: number;
  ratePercent: number;
  /** Rollierende Quote (%) je Einheit, älteste zuerst — für die Sparkline */
  series: number[];
};

function hashSeed(value: string): number {
  let hash = 7;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * Deterministischer PRNG (mulberry32-Variante) — lokale Kopie statt Import
 * aus lib/mock/util, damit der Screen keinerlei lib/mock-Abhängigkeit hat.
 * Identischer Algorithmus ⇒ identische Demo-Optik wie vor der Migration.
 */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ATTENDANCE_WINDOW = 8;

/**
 * Anwesenheits-Quote über die letzten Trainingseinheiten:
 * echte Anwesenheits-Einträge zählen 1:1; ältere Einheiten werden
 * deterministisch (Seed = personId) aufgefüllt, damit der Verlauf
 * server- und clientseitig identisch bleibt (Demo-Phase ohne Backend).
 */
export function attendanceStats(
  member: Member,
  events: Event[],
  attendance: Attendance[],
): AttendanceStats | null {
  if (member.teamIds.length === 0) return null;

  const now = Date.now();
  const pastTrainings = events
    .filter(
      (event) =>
        event.type === "training" &&
        new Date(event.endsAt).getTime() < now &&
        event.teamIds.some((teamId) => member.teamIds.includes(teamId)),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const recorded: boolean[] = [];
  for (const event of pastTrainings) {
    const record = attendance.find((a) => a.eventId === event.id && a.memberId === member.id);
    if (record) recorded.push(record.status === "present" || record.status === "late");
  }

  const syntheticCount = Math.max(0, ATTENDANCE_WINDOW - recorded.length);
  const random = seededRandom(hashSeed(member.id));
  const synthetic = Array.from({ length: syntheticCount }, () => random() < 0.85);

  // Älteste (synthetische) Einheiten zuerst, echte Einträge zuletzt.
  const sessions = [...synthetic, ...recorded].slice(-ATTENDANCE_WINDOW);
  const present = sessions.filter(Boolean).length;

  const series: number[] = [];
  let presentSoFar = 0;
  sessions.forEach((wasPresent, index) => {
    if (wasPresent) presentSoFar += 1;
    series.push(Math.round((presentSoFar / (index + 1)) * 100));
  });

  return {
    total: sessions.length,
    present,
    ratePercent: Math.round((present / sessions.length) * 100),
    series,
  };
}

/* ---------- Alter & Zugehörigkeit ---------- */

export function ageYears(birthDateIso: string, now: Date = new Date()): number {
  const birth = new Date(birthDateIso);
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
