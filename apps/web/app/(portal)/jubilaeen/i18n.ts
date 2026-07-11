import type { Dict } from "@/lib/i18n";
import type { AnniversaryKind } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary der Jubiläen (Geburtstage & Vereinsjubiläen).
 * Reine Lesesicht für alle Mitglieder (is_club_member). Regel: JEDE Ergänzung
 * in beiden Sprachen, deutsche Strings mit echten Umlauten (ä/ö/ü/ß) —
 * nie ae/oe/ue/ss.
 */
export const jubilaeenDict = {
  de: {
    pageEyebrow: "Zu feiern",
    pageTitle: "Jubiläen & Meilensteine",
    pageSub:
      "Runde Vereinsjubiläen und Geburtstage der nächsten zwölf Monate — chronologisch, damit niemand vergessen wird.",

    // Filter
    filterLabel: "Jubiläen filtern",
    filterAll: "Alle",
    filterMembership: "Vereinsjubiläen",
    filterBirthday: "Geburtstage",

    // Als Nächstes (Hero)
    nextUpEyebrow: "Als Nächstes",

    // Art des Jubiläums
    kindMembership: "Vereinsjubiläum",
    kindBirthday: "Geburtstag",
    milestoneMembership: "{years} Jahre Mitglied",
    milestoneBirthday: "wird {years}",

    // Countdown
    countToday: "heute",
    countTomorrow: "morgen",
    countDays: "in {n} Tagen",
    /** a11y: „In 12 Tagen, Mi., 15. Juli" */
    countAria: "{count}, am {date}",

    // Zustände
    emptyTitle: "Nichts zu feiern — noch",
    emptyBody:
      "In den nächsten zwölf Monaten stehen keine runden Vereinsjubiläen oder Geburtstage an. Schau später wieder vorbei.",
    filterEmpty: "Für diese Auswahl gibt es keine Jubiläen im nächsten Jahr.",
    loadErrorTitle: "Jubiläen konnten nicht geladen werden",
    retry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Die Jubiläen haben im api-Modus noch keinen Endpoint.",
  },
  en: {
    pageEyebrow: "To celebrate",
    pageTitle: "Anniversaries & milestones",
    pageSub:
      "Round club anniversaries and birthdays over the next twelve months — in order, so no one is forgotten.",

    filterLabel: "Filter anniversaries",
    filterAll: "All",
    filterMembership: "Club anniversaries",
    filterBirthday: "Birthdays",

    nextUpEyebrow: "Up next",

    kindMembership: "Club anniversary",
    kindBirthday: "Birthday",
    milestoneMembership: "{years} years a member",
    milestoneBirthday: "turns {years}",

    countToday: "today",
    countTomorrow: "tomorrow",
    countDays: "in {n} days",
    countAria: "{count}, on {date}",

    emptyTitle: "Nothing to celebrate — yet",
    emptyBody:
      "There are no round club anniversaries or birthdays in the next twelve months. Check back later.",
    filterEmpty: "No anniversaries match this filter within the next year.",
    loadErrorTitle: "Anniversaries could not be loaded",
    retry: "Try again",
    niTitle: "Not connected yet",
    niBody: "Anniversaries have no endpoint in api mode yet.",
  },
} satisfies Dict;

/** Schlüssel-Typ des Jubiläen-Dictionaries (für typsichere Label-Maps). */
export type JubilaeenKey = keyof (typeof jubilaeenDict)["de"];

/** Jubiläums-Art → Dictionary-Label-Schlüssel (Art bzw. Meilenstein). */
export function kindLabelKey(kind: AnniversaryKind): JubilaeenKey {
  return kind === "birthday" ? "kindBirthday" : "kindMembership";
}

export function milestoneLabelKey(kind: AnniversaryKind): JubilaeenKey {
  return kind === "birthday" ? "milestoneBirthday" : "milestoneMembership";
}
