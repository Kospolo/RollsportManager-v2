import type { Dict, Locale } from "@/lib/i18n";
import type { BadgeTone } from "@/components/ui/Badge";
import type { RoutineStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary des Küren-Moduls (Liste + Detail + Player).
 * IMMER beide Sprachen vollständig, deutsche Strings mit echten Umlauten.
 * Schmales Leerzeichen ( ) vor % und s gemäß DESIGN-SYSTEM §2.4.
 */
export const kuerenDict = {
  de: {
    /* Liste */
    pageTitle: "Küren",
    pageSub: "Musik, Marker und RollArt-Wertungen deiner Kürgruppe",
    newRoutine: "Neue Kür",
    demoUnavailable: "Demo-Modus: Diese Aktion ist in der Vorschau nicht verfügbar.",
    filterLabel: "Küren nach Status filtern",
    filterAll: "Alle",
    statusDraft: "Entwurf",
    statusReady: "Wettkampfbereit",
    statusCompetition: "Im Wettkampf",
    statusArchived: "Archiviert",
    disciplineSingle: "Einzellauf",
    disciplinePair: "Paarlauf",
    lastScoreLabel: "Letzte RollArt-Wertung",
    noScoreYet: "Noch keine Wertung",
    points: "Punkte",
    listEmptyTitle: "Keine Küren in dieser Ansicht",
    listEmptyBody: "Ändere den Filter oder lege eine neue Kür mit Musik an.",
    listEmptyCta: "Alle anzeigen",

    /* Laden & Fehler (Facade) */
    loadErrorTitle: "Daten konnten nicht geladen werden",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
    notFoundTitle: "Kür nicht gefunden",
    notFoundBody: "Diese Kür existiert nicht oder wurde entfernt.",
    notFoundBack: "Zurück zu den Küren",
    competitionFallback: "Wettkampf",
    competitionNamesPending: "Wettkampf-Namen sind im api-Modus noch nicht angebunden.",

    /* Detail-Kopf */
    breadcrumbLabel: "Pfadnavigation",
    editAction: "Bearbeiten",
    exportAction: "Für Wettkampf exportieren",
    metaLength: "Länge {dur}",
    metaBpm: "{bpm} BPM",

    /* Player */
    playerEyebrow: "Trainings-Player",
    demoHint: "Demo ohne Audiodatei — Wiedergabe wird simuliert",
    loopChip: "Loop {a}–{b}",
    waveLabel: "Wellenform der Kürmusik — klicken oder Pfeiltasten zum Springen",
    waveValueText: "{pos} von {dur}",
    playLabel: "Abspielen",
    pauseLabel: "Pause",
    skipBackLabel: "5 Sekunden zurück",
    skipFwdLabel: "5 Sekunden vor",
    countdownEyebrow: "Countdown",
    countdownGroupLabel: "Countdown vor dem Start",
    countdownOff: "Aus",
    countdownSeconds: "{s} s",
    startingIn: "Start in {s} s",
    loopEyebrow: "A–B-Loop",
    loopOn: "aktiv",
    loopOffWord: "aus",
    loopToggleLabel: "A–B-Loop",
    setLoopA: "Loop-Punkt A auf aktuelle Position setzen",
    setLoopB: "Loop-Punkt B auf aktuelle Position setzen",
    inLoop: "im Loop",
    tempoEyebrow: "Tempo",
    tempoGroupLabel: "Tempo wählen",
    tempoSliderLabel: "Tempo-Feinregler, 50 bis 200 Prozent, aktuell {tempo} Prozent",
    tempoNote: "bei {tempo} % läuft die Kür {slow} statt {orig} · Tonhöhe bleibt erhalten",
    tempoNoteOriginal: "Originaltempo — die Kür läuft {orig} · Tonhöhe bleibt erhalten",
    kbdSpace: "Leertaste",
    hintPlay: "Start/Stopp",
    hintLoop: "Loop an/aus",
    hintSeek: "5 s springen",
    hintFocus: "wenn der Player fokussiert ist",

    /* Markierungen */
    markersEyebrow: "Markierungen",
    markersTitle: "Elemente in der Kür",
    addMarker: "Markierung",
    newMarkerLabel: "Neue Markierung",
    markerAdded: "Markierung bei {time} gesetzt.",
    noPermission: "Keine Berechtigung — die Markierung wurde nicht gespeichert.",
    jumpToMarker: "Zu {time} springen: {label}",
    playFrom: "Ab {time} abspielen",

    /* RollArt-Verlauf */
    scoreEyebrow: "RollArt-Verlauf",
    scoreTitle: "Wertung über die Saison",
    scoreEmpty: "Noch keine Wertung — nach dem ersten Wettkampf entsteht hier der Verlauf.",
    trainingScore: "Trainingsmessung",
    firstScore: "Erster Wert",
    technicalShort: "Technik {value}",
    componentsShort: "Komponenten {value}",
    sinceFirst: "{delta} Punkte seit der ersten Wertung",
    sinceFirstPlain: "Punkte seit der ersten Wertung",
    bestValue: "Bestwert {best} Punkte",
    sparkLabel: "Wertungsverlauf: {values} Punkte",

    /* Notizen */
    notesEyebrow: "Notizen",
    notesTitle: "Trainingsnotizen",
    notesLabel: "Notiz zur Kür",
    notesHint: "Wird nur lokal auf diesem Gerät gespeichert.",
    notesPlaceholder: "Was lief gut? Was üben wir im Loop weiter? …",
    saveNote: "Notiz speichern",
    noteSaved: "Notiz gespeichert.",
    noteSaveError: "Speichern fehlgeschlagen.",
    retry: "Wiederholen",
    lastSaved: "Zuletzt gespeichert: {when}",
  },
  en: {
    /* List */
    pageTitle: "Routines",
    pageSub: "Music, markers and RollArt scores for your skaters",
    newRoutine: "New routine",
    demoUnavailable: "Demo mode: this action is not available in the preview.",
    filterLabel: "Filter routines by status",
    filterAll: "All",
    statusDraft: "Draft",
    statusReady: "Competition-ready",
    statusCompetition: "Competing",
    statusArchived: "Archived",
    disciplineSingle: "Singles",
    disciplinePair: "Pairs",
    lastScoreLabel: "Last RollArt score",
    noScoreYet: "No score yet",
    points: "points",
    listEmptyTitle: "No routines in this view",
    listEmptyBody: "Change the filter or create a new routine with music.",
    listEmptyCta: "Show all",

    /* Loading & errors (facade) */
    loadErrorTitle: "Could not load data",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no API endpoint in api mode yet.",
    notFoundTitle: "Routine not found",
    notFoundBody: "This routine does not exist or has been removed.",
    notFoundBack: "Back to routines",
    competitionFallback: "Competition",
    competitionNamesPending: "Competition names are not connected in api mode yet.",

    /* Detail head */
    breadcrumbLabel: "Breadcrumb",
    editAction: "Edit",
    exportAction: "Export for competition",
    metaLength: "Length {dur}",
    metaBpm: "{bpm} BPM",

    /* Player */
    playerEyebrow: "Training player",
    demoHint: "Demo without audio file — playback is simulated",
    loopChip: "Loop {a}–{b}",
    waveLabel: "Waveform of the routine music — click or use arrow keys to seek",
    waveValueText: "{pos} of {dur}",
    playLabel: "Play",
    pauseLabel: "Pause",
    skipBackLabel: "Back 5 seconds",
    skipFwdLabel: "Forward 5 seconds",
    countdownEyebrow: "Countdown",
    countdownGroupLabel: "Countdown before start",
    countdownOff: "Off",
    countdownSeconds: "{s} s",
    startingIn: "Starting in {s} s",
    loopEyebrow: "A–B loop",
    loopOn: "on",
    loopOffWord: "off",
    loopToggleLabel: "A–B loop",
    setLoopA: "Set loop point A to the current position",
    setLoopB: "Set loop point B to the current position",
    inLoop: "in loop",
    tempoEyebrow: "Tempo",
    tempoGroupLabel: "Choose tempo",
    tempoSliderLabel: "Fine tempo control, 50 to 200 percent, currently {tempo} percent",
    tempoNote: "at {tempo}% the routine runs {slow} instead of {orig} · pitch is preserved",
    tempoNoteOriginal: "Original tempo — the routine runs {orig} · pitch is preserved",
    kbdSpace: "Space",
    hintPlay: "Start/stop",
    hintLoop: "Loop on/off",
    hintSeek: "jump 5 s",
    hintFocus: "while the player has focus",

    /* Markers */
    markersEyebrow: "Markers",
    markersTitle: "Elements in the routine",
    addMarker: "Marker",
    newMarkerLabel: "New marker",
    markerAdded: "Marker set at {time}.",
    noPermission: "No permission — the marker was not saved.",
    jumpToMarker: "Jump to {time}: {label}",
    playFrom: "Play from {time}",

    /* RollArt history */
    scoreEyebrow: "RollArt history",
    scoreTitle: "Scores across the season",
    scoreEmpty: "No scores yet — the trend will appear here after the first competition.",
    trainingScore: "Training run",
    firstScore: "First score",
    technicalShort: "Technical {value}",
    componentsShort: "Components {value}",
    sinceFirst: "{delta} points since the first score",
    sinceFirstPlain: "points since the first score",
    bestValue: "Best score {best} points",
    sparkLabel: "Score trend: {values} points",

    /* Notes */
    notesEyebrow: "Notes",
    notesTitle: "Training notes",
    notesLabel: "Note for this routine",
    notesHint: "Stored locally on this device only.",
    notesPlaceholder: "What went well? What do we keep looping? …",
    saveNote: "Save note",
    noteSaved: "Note saved.",
    noteSaveError: "Saving failed.",
    retry: "Retry",
    lastSaved: "Last saved: {when}",
  },
} satisfies Dict;

export type KuerenKey = keyof (typeof kuerenDict)["de"];

/* ------------------------------------------------------------------
   Gemeinsame Helfer für Liste + Detail (Status, Disziplin, Punkte).
   ------------------------------------------------------------------ */

/** Status → Chip-Ton — Status trägt IMMER Farbe + Wort. */
export const STATUS_TONE: Record<RoutineStatus, BadgeTone> = {
  draft: "neutral",
  ready: "success",
  competition: "info",
  archived: "neutral",
};

export const STATUS_KEY: Record<RoutineStatus, KuerenKey> = {
  draft: "statusDraft",
  ready: "statusReady",
  competition: "statusCompetition",
  archived: "statusArchived",
};

/** Disziplin aus der Besetzung abgeleitet: 1 = Einzellauf, 2+ = Paarlauf. */
export function disciplineKey(memberCount: number): KuerenKey {
  return memberCount >= 2 ? "disciplinePair" : "disciplineSingle";
}

/* RollArt-Punkte: immer 2 Nachkommastellen, echtes Minuszeichen (−). */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

export function formatPoints(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Delta mit Vorzeichen: "+1,30" / "−0,25" / "±0,00". */
export function formatPointsDelta(value: number, locale: Locale): string {
  const abs = formatPoints(Math.abs(value), locale);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return `±${abs}`;
}
