import { club } from "@/lib/mock";
import type { Sparte } from "@/lib/types";

/**
 * Start-Seed des Sparten-Stores fuer den Mock-Modus. Echte Umlaute, DE-Inhalte,
 * plausible Mitglieder-IDs aus lib/mock. So lebt die Sparten-Seite auch ohne
 * Dev-Stack: Rollkunstlauf + Eiskunstlauf (aktiv) und ein inaktives Beispiel.
 */

const clubId = club.id;

const dateDaysAgo = (days: number): string =>
  `${new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)}T09:00:00.000Z`;

export const sparteSeed: Sparte[] = [
  {
    id: "sp-01",
    clubId,
    name: "Rollkunstlauf",
    icon: "routines",
    color: "#B23A5C",
    active: true,
    sortOrder: 0,
    ownFinances: true,
    memberIds: ["m-15", "m-16", "m-17", "m-18", "m-19"],
    createdAt: dateDaysAgo(400),
    updatedAt: dateDaysAgo(30),
  },
  {
    id: "sp-02",
    clubId,
    name: "Eiskunstlauf",
    icon: "competition",
    color: "#3E7D83",
    active: true,
    sortOrder: 1,
    ownFinances: false,
    memberIds: ["m-07", "m-08", "m-11"],
    createdAt: dateDaysAgo(360),
    updatedAt: dateDaysAgo(60),
  },
  {
    id: "sp-03",
    clubId,
    name: "Inline-Speedskating",
    icon: "zap",
    color: "#8A4E9C",
    active: false,
    sortOrder: 2,
    ownFinances: false,
    memberIds: [],
    createdAt: dateDaysAgo(200),
    updatedAt: dateDaysAgo(120),
  },
];
