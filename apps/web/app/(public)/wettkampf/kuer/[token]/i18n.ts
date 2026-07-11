import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der öffentlichen Kür-Ansicht. Beide Sprachen
 * vollständig, deutsche Strings mit echten Umlauten. Schmales Leerzeichen ( )
 * vor Einheiten gemäß DESIGN-SYSTEM §2.4.
 */
export const publicKuerDict = {
  de: {
    eyebrow: "Öffentliche Kür",
    clubLabel: "Verein",
    metaLength: "Länge {dur}",
    metaBpm: "{bpm} BPM",

    musicEyebrow: "Musik",
    musicTitle: "Kürmusik",
    noMusic: "Keine Musikangaben hinterlegt.",

    timelineEyebrow: "Ablauf",
    timelineTitle: "Elemente in der Kür",
    timelineAria: "Zeitleiste der Kürmusik mit Markierungen",
    markersEmpty: "Keine Markierungen hinterlegt.",

    scoresEyebrow: "Wertung",
    scoresTitle: "Wertungs-Verlauf",
    scoresEmpty: "Noch keine Wertung.",
    colDate: "Datum",
    colTechnical: "Technik",
    colComponents: "Komponenten",
    colTotal: "Gesamt",
    colPlacement: "Platz",

    loadingLabel: "Kür wird geladen",
    notFoundTitle: "Link ungültig",
    notFoundBody: "Dieser Teilen-Link ist ungültig, abgelaufen oder wurde widerrufen.",
    errorTitle: "Kür konnte nicht geladen werden",
    retry: "Erneut versuchen",
  },
  en: {
    eyebrow: "Public routine",
    clubLabel: "Club",
    metaLength: "Length {dur}",
    metaBpm: "{bpm} BPM",

    musicEyebrow: "Music",
    musicTitle: "Routine music",
    noMusic: "No music details provided.",

    timelineEyebrow: "Sequence",
    timelineTitle: "Elements in the routine",
    timelineAria: "Timeline of the routine music with markers",
    markersEmpty: "No markers provided.",

    scoresEyebrow: "Scores",
    scoresTitle: "Score history",
    scoresEmpty: "No scores yet.",
    colDate: "Date",
    colTechnical: "Technical",
    colComponents: "Components",
    colTotal: "Total",
    colPlacement: "Rank",

    loadingLabel: "Loading routine",
    notFoundTitle: "Invalid link",
    notFoundBody: "This share link is invalid, has expired or has been revoked.",
    errorTitle: "Could not load routine",
    retry: "Try again",
  },
} satisfies Dict;

export type PublicKuerKey = keyof (typeof publicKuerDict)["de"];
