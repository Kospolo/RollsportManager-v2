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

/**
 * Meilenstein-Text — es gibt ihn NUR fuer Vereinsjubilaeen.
 *
 * Frueher stand hier fuer Geburtstage "wird {years}" / "turns {years}". Genau
 * das ist die Zeile, die das Alter eines Kindes an jedes Vereinsmitglied
 * ausgab: zusammen mit `date` liess sich daraus das exakte Geburtsdatum
 * zurueckrechnen. Die API liefert bei Geburtstagen deshalb years=null (siehe
 * services/api reports.ts), und die Karte zeigt dort nichts an — der
 * Art-Chip sagt bereits "Geburtstag", das Datum steht rechts daneben. Fuer den
 * Verein ist "Emma · Geburtstag · 3. Nov" genau die Information, die er
 * braucht.
 *
 * Bei kind="membership" ist die Zahl der ganze Sinn ("10 Jahre Mitglied") und
 * bleibt.
 */
export function milestoneLabelKey(_kind: AnniversaryKind): JubilaeenKey {
  return "milestoneMembership";
}
