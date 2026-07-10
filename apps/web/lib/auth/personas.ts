import type { DevClubRole, DevPersonaKey } from "./storage";

/**
 * Anzeige-Metadaten der Dev-Personas — Quelle der Wahrheit für sub/member_id
 * ist services/api/src/routes/dev-login.ts (DEV_PERSONAS); hier stehen nur
 * die UI-Texte für die Login-Karten (DE und EN, echte Umlaute).
 */

export interface DevPersonaCard {
  key: DevPersonaKey;
  /** app.club_members.id aus dem Seed — für den Avatar-Farbton. */
  memberId: string;
  displayName: string;
  clubRole: DevClubRole;
  role: { de: string; en: string };
  description: { de: string; en: string };
}

export const DEV_PERSONA_CARDS: DevPersonaCard[] = [
  {
    key: "coach",
    memberId: "a0000000-0000-4000-8000-000000000001",
    displayName: "Sandra Vogel",
    clubRole: "coach",
    role: { de: "Trainerin", en: "Coach" },
    description: {
      de: "Termine, Mitglieder und Küren — kein Kassenbuch.",
      en: "Events, members and routines — no ledger access.",
    },
  },
  {
    key: "owner",
    memberId: "a0000000-0000-4000-8000-000000000002",
    displayName: "Jürgen Häberle",
    clubRole: "owner",
    role: { de: "Vorstand", en: "Owner" },
    description: {
      de: "Sieht und darf alles — einziger Owner im Verein.",
      en: "Sees and manages everything — the club's only owner.",
    },
  },
  {
    key: "treasurer",
    memberId: "a0000000-0000-4000-8000-000000000003",
    displayName: "Beate Schäfer",
    clubRole: "treasurer",
    role: { de: "Kassenwartin", en: "Treasurer" },
    description: {
      de: "Rechnungen, Mahnwesen und Finanzen.",
      en: "Invoices, dunning and finances.",
    },
  },
  {
    key: "member",
    memberId: "a0000000-0000-4000-8000-000000000009",
    displayName: "Katrin Grünewald",
    clubRole: "member",
    role: { de: "Mitglied", en: "Member" },
    description: {
      de: "Elternteil von Lina — sieht nur die eigene Familie.",
      en: "Lina's parent — sees only her own family.",
    },
  },
  {
    key: "guest",
    memberId: "a0000000-0000-4000-8000-000000000006",
    displayName: "Milena Öztürk",
    clubRole: "guest_coach",
    role: { de: "Gasttrainerin", en: "Guest coach" },
    description: {
      de: "Befristeter Zugang (30 Tage) für Küren und Anwesenheit.",
      en: "Time-boxed access (30 days) for routines and attendance.",
    },
  },
];

export function personaByKey(key: DevPersonaKey): DevPersonaCard | undefined {
  return DEV_PERSONA_CARDS.find((p) => p.key === key);
}

/** Generische Rollen-Labels (z. B. fürs Benutzermenü, wenn die Persona fehlt). */
export const ROLE_LABELS: Record<DevClubRole, { de: string; en: string }> = {
  owner: { de: "Vorstand", en: "Owner" },
  admin: { de: "Verwaltung", en: "Admin" },
  treasurer: { de: "Kassenwart:in", en: "Treasurer" },
  coach: { de: "Trainer:in", en: "Coach" },
  member: { de: "Mitglied", en: "Member" },
  guest_coach: { de: "Gasttrainer:in", en: "Guest coach" },
};
