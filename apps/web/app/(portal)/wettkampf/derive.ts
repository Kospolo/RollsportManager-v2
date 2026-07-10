import type { Locale } from "@/lib/i18n";
import {
  competitions,
  guardianships,
  invoices,
  memberById,
  routineById,
  tasks,
  teams,
} from "@/lib/mock";
import type {
  Competition,
  Invoice,
  Member,
  RollArtScore,
  Routine,
  Task,
  Team,
} from "@/lib/types";

/** Kolokalisierte Helfer des Wettkampf-Screens — reine Ableitungen aus lib/mock. */

export const nextCompetition = competitions.find((c) => c.status === "upcoming");
export const pastCompetitions = competitions.filter((c) => c.status === "done");

export function competitionTasks(competition: Competition): Task[] {
  return tasks.filter((task) => task.competitionId === competition.id);
}

/* ---------- Meldungen ---------- */

export type FeeStatus = "paid" | "open" | "none";

export type StarterEntry = {
  member: Member;
  team?: Team;
  /** Kür dieses Starters IN diesem Wettkampf (falls gemeldet) */
  routine?: Routine;
  /** Startgeld-Rechnung (auch an Erziehungsberechtigte adressiert) */
  invoice?: Invoice;
  feeStatus: FeeStatus;
};

/** Startgeld-Rechnung: direkt an den Starter oder an Erziehungsberechtigte („… — Lina“). */
function entryFeeInvoiceFor(member: Member): Invoice | undefined {
  const guardianIds = guardianships
    .filter((g) => g.childId === member.id)
    .map((g) => g.guardianId);
  return invoices.find(
    (invoice) =>
      invoice.title.startsWith("Wettkampfmeldung") &&
      (invoice.memberId === member.id ||
        (guardianIds.includes(invoice.memberId) && invoice.title.includes(member.firstName))),
  );
}

export function starterEntries(competition: Competition): StarterEntry[] {
  const competitionRoutines = competition.routineIds
    .map((id) => routineById(id))
    .filter((routine): routine is Routine => routine !== undefined);

  return competition.participantIds
    .map((id) => memberById(id))
    .filter((member): member is Member => member !== undefined)
    .map((member) => {
      const routine = competitionRoutines.find((r) => r.memberIds.includes(member.id));
      const invoice = entryFeeInvoiceFor(member);
      const feeStatus: FeeStatus =
        invoice === undefined ? "none" : invoice.status === "paid" ? "paid" : "open";
      return {
        member,
        team: teams.find((team) => member.teamIds.includes(team.id)),
        routine,
        invoice,
        feeStatus,
      };
    });
}

export function entryStats(entries: StarterEntry[]) {
  const ready = entries.filter((entry) => entry.routine !== undefined).length;
  const feePaid = entries.filter((entry) => entry.feeStatus === "paid").length;
  const feeOpen = entries.filter((entry) => entry.feeStatus === "open").length;
  return {
    starters: entries.length,
    ready,
    missing: entries.length - ready,
    routines: new Set(entries.flatMap((e) => (e.routine ? [e.routine.id] : []))).size,
    feePaid,
    feeOpen,
    feeNone: entries.length - feePaid - feeOpen,
  };
}

/* ---------- Live-Modus ---------- */

export type StartItem = {
  routine: Routine;
  skaters: Member[];
  /** Letzte RollArt-Wertung (Setzlisten-Wert) — undefined bei Erststart */
  lastScore?: RollArtScore;
};

/** Lokal erfasste Wertung der Schnelleingabe (nur React-State, kein Backend). */
export type EnteredScore = {
  routineId: string;
  technical: number;
  components: number;
};

/** Fließkomma-sauber auf 2 Nachkommastellen (0,1er-Stepper). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function totalOf(score: EnteredScore): number {
  return round2(score.technical + score.components);
}

/** Startreihenfolge nach Setzliste: ohne Wertung zuerst, dann aufsteigend nach letzter Gesamtwertung. */
export function startOrder(competition: Competition): StartItem[] {
  return competition.routineIds
    .map((id) => routineById(id))
    .filter((routine): routine is Routine => routine !== undefined)
    .map((routine) => ({
      routine,
      skaters: routine.memberIds
        .map((id) => memberById(id))
        .filter((member): member is Member => member !== undefined),
      lastScore: routine.scores.at(-1),
    }))
    .sort((a, b) => (a.lastScore?.total ?? -1) - (b.lastScore?.total ?? -1));
}

/* ---------- Ergebnisse vergangener Wettkämpfe ---------- */

export type PastResult = {
  routine: Routine;
  skaters: Member[];
  score: RollArtScore;
  /** Vorherige Wertung derselben Kür — Basis für das Delta */
  previous?: RollArtScore;
};

export function pastResults(competition: Competition): PastResult[] {
  return competition.routineIds
    .map((id) => routineById(id))
    .filter((routine): routine is Routine => routine !== undefined)
    .flatMap((routine) => {
      const index = routine.scores.findIndex((s) => s.competitionId === competition.id);
      if (index < 0) return [];
      return [
        {
          routine,
          skaters: routine.memberIds
            .map((id) => memberById(id))
            .filter((member): member is Member => member !== undefined),
          score: routine.scores[index],
          previous: index > 0 ? routine.scores[index - 1] : undefined,
        },
      ];
    })
    .sort((a, b) => b.score.total - a.score.total);
}

/* ---------- Zahlenformat für RollArt-Wertungen ---------- */

const SCORE_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

/** 44.1 → "44,10" (de) / "44.10" (en) — immer zwei Nachkommastellen, tabular rendern. */
export function formatScore(value: number, locale: Locale): string {
  return new Intl.NumberFormat(SCORE_LOCALE[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Vorzeichenbehaftetes Delta mit echtem Minuszeichen: "+1,30" / "−0,25". */
export function formatScoreDelta(value: number, locale: Locale): string {
  const abs = formatScore(Math.abs(value), locale);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return `±${abs}`;
}

/** "Marie Süß & Lukas Öhler" — Paar-/Gruppenküren mit &-Verbund. */
export function skaterNames(skaters: Member[]): string {
  return skaters.map((m) => `${m.firstName} ${m.lastName}`).join(" & ");
}
