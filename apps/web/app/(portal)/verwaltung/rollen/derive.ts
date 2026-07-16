import type {
  CapabilityEnforcement,
  CapabilityLevel,
  ClubRoleDef,
  ResolvedCapability,
} from "@/lib/data";
import type { Member } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/Badge";
import type { RollenKey } from "./i18n";

/**
 * Reine Ableitungen für die Steuerzentrale „Rollen & Rechte" — kein State,
 * keine UI.
 *
 * ### Was hier NICHT mehr steht ###
 * Die alte Fassung kannte 5 fest verdrahtete Fähigkeiten und 7 feste Rollen und
 * rechnete die Matrix aus lib/data/permissions aus. Beides war gegen den
 * heutigen Server falsch: er hat 32 Fähigkeiten (`select count(*) from
 * app.capabilities` → 32), und `app.roles` ist pro Verein editierbar (eigene
 * Rollen seit roles.ts:159). Alles unten arbeitet deshalb auf den DATEN vom
 * Server, nicht auf Konstanten.
 */

/** Rang einer Stufe (0..5) — das Gegenstück zu app.level_rank (0022:37-52). */
export const LEVEL_RANK: Readonly<Record<CapabilityLevel, number>> = {
  none: 0,
  read_own: 1,
  read_team: 2,
  read_all: 3,
  edit: 4,
  manage: 5,
};

/** Die Stufe einer Rolle bei einer Fähigkeit. Nicht gesetzt = none (fail-closed). */
export function levelOf(
  permissions: ReadonlyMap<string, CapabilityLevel>,
  capabilityKey: string,
): CapabilityLevel {
  return permissions.get(capabilityKey) ?? "none";
}

/* ------------------------------------------------------------------------- *
 * Die Beschriftung der Stufen — und warum sie von `enforcement` abhängt
 * ------------------------------------------------------------------------- */

/**
 * DER KERN DER EHRLICHKEIT. Wie „keine" beschriftet werden DARF, hängt davon
 * ab, was der Server bei DIESER Fähigkeit tatsächlich durchsetzt (0033):
 *
 *   enforced   → „Kein Zugriff". Stimmt: das Lesen ist wirklich weg.
 *   partial    → „Kein Bearbeiten". „Kein Zugriff" wäre eine Lüge — bei
 *                finance bleiben Bankkonto/Budgets/Beiträge/SEPA/Spenden/
 *                Mahnungen sichtbar, bei member_contact zeigt der Roster
 *                weiterhin E-Mail und Geburtsdatum (beides live gemessen).
 *   write_only → „Kein Bearbeiten". Gelesen wird weiter.
 *   unenforced → „Kein Bearbeiten" — und die Zeile trägt zusätzlich einen
 *                sichtbaren Hinweis, dass die Einstellung noch nichts bewirkt.
 *
 * Kurz: „Kein Zugriff" gibt es NUR bei 'enforced'. Überall sonst verspräche das
 * Wort etwas, das der Server nicht einlöst.
 */
export function noneLabelKey(enforcement: CapabilityEnforcement): RollenKey {
  return enforcement === "enforced" ? "levelNoneOff" : "levelNoneNoEdit";
}

/** i18n-Schlüssel der Stufen-Beschriftung, abhängig vom Etikett der Fähigkeit. */
export function levelLabelKey(
  level: CapabilityLevel,
  enforcement: CapabilityEnforcement,
): RollenKey {
  switch (level) {
    case "none":
      return noneLabelKey(enforcement);
    case "read_own":
      return "levelReadOwn";
    case "read_team":
      return "levelReadTeam";
    case "read_all":
      return "levelReadAll";
    case "edit":
      return "levelEdit";
    case "manage":
      return "levelManage";
  }
}

/** i18n-Schlüssel des Etiketts (die Kurzform am Zeilenkopf). */
export function enforcementLabelKey(enforcement: CapabilityEnforcement): RollenKey {
  switch (enforcement) {
    case "enforced":
      return "enfEnforced";
    case "partial":
      return "enfPartial";
    case "write_only":
      return "enfWriteOnly";
    case "unenforced":
      return "enfUnenforced";
  }
}

/** i18n-Schlüssel der ausführlichen Begründung (Hinweiszeile unter der Matrix). */
export function enforcementHintKey(enforcement: CapabilityEnforcement): RollenKey {
  switch (enforcement) {
    case "enforced":
      return "enfEnforcedHint";
    case "partial":
      return "enfPartialHint";
    case "write_only":
      return "enfWriteOnlyHint";
    case "unenforced":
      return "enfUnenforcedHint";
  }
}

/**
 * Der Ton des Etiketts. 'enforced' ist der einzige grüne Fall — nur dort tut
 * die Einstellung, was ein Mensch von ihr erwartet. 'partial' ist ausdrücklich
 * WARNEND (nicht neutral): dort verspräche das Wort „keine" Vertraulichkeit,
 * die es nicht gibt, und genau davor muss die Oberfläche warnen.
 */
export function enforcementTone(enforcement: CapabilityEnforcement): BadgeTone {
  switch (enforcement) {
    case "enforced":
      return "success";
    case "partial":
      return "warn";
    case "write_only":
      return "info";
    case "unenforced":
      return "neutral";
  }
}

/* ------------------------------------------------------------------------- *
 * Rollen
 * ------------------------------------------------------------------------- */

/** Ton der Rollen-Pille: die geschützte Inhaber-Rolle sticht heraus. */
export function roleTone(role: ClubRoleDef): BadgeTone {
  if (role.protected) return "brand";
  if (!role.isSystem) return "success";
  return "info";
}

/** Rollen in Server-Reihenfolge (sort, dann key) — nie nach dem Namen sortieren. */
export function sortRoles(roles: readonly ClubRoleDef[]): ClubRoleDef[] {
  return [...roles].sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
}

/** Fähigkeiten in Katalog-Reihenfolge (sort, dann key). */
export function sortCapabilities(caps: readonly ResolvedCapability[]): ResolvedCapability[] {
  return [...caps].sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
}

/**
 * Darf die eingeloggte Person die Zeile dieser Fähigkeit bearbeiten?
 * `roles:manage` allein genügt bei geschützten Fähigkeiten NICHT (0032) —
 * sonst gäbe sich, wer Rollen verwaltet, alles selbst zurück.
 */
export function mayEditCapability(cap: ResolvedCapability, isOwner: boolean): boolean {
  return !cap.ownerOnly || isOwner;
}

/**
 * Der Vorschlag beim Anlegen einer eigenen Rolle: aus dem deutschen Namen einen
 * Schlüssel bauen, der ^[a-z][a-z0-9_]{1,40}$ erfüllt (der Server weist alles
 * andere mit 422 ab). Umlaute werden hier ausgeschrieben — das ist der EINZIGE
 * Ort im Projekt, an dem das richtig ist: der Schlüssel ist eine technische
 * Kennung, die der Server so verlangt, und wird nirgends als Text angezeigt.
 */
export function suggestRoleKey(nameDe: string): string {
  const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
  const base = nameDe
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => map[c] ?? c)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 41);
  if (base.length < 2) return "";
  return /^[a-z]/.test(base) ? base : `r_${base}`.slice(0, 41);
}

/** Erfüllt der Schlüssel die Server-Regel? (Vor dem 422, nicht statt seiner.) */
export function isValidRoleKey(key: string): boolean {
  return /^[a-z][a-z0-9_]{1,40}$/.test(key);
}

/* ------------------------------------------------------------------------- *
 * Personen
 * ------------------------------------------------------------------------- */

/** Mitglieder alphabetisch (Nachname, Vorname) — die Rolle sortiert hier nicht. */
export function sortMembers(members: readonly Member[]): Member[] {
  return [...members].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de"),
  );
}
