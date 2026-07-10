import type { Dict } from "@/lib/i18n";
import type { BadgeTone } from "@/components/ui/Badge";
import type { DutyKind } from "@/lib/types";
import type { SollLevel } from "./logic";

/**
 * Kolokalisiertes Dictionary der Pflichtstunden (Meine Stunden = Soll/Ist +
 * eigene Einträge + Erfassen-Sheet; für Trainer:innen zusätzlich offene
 * Genehmigungen + Vereins-Übersicht). IMMER beide Sprachen vollständig,
 * deutsche Strings mit echten Umlauten.
 *
 * Rechte sind serverseitig (RLS + Rollencheck): eigene Ist-Stunden erfasst
 * jedes Mitglied für sich, `approved` setzen dürfen NUR Trainer:innen
 * (DB-Trigger app.duty_entries_guard_approved → 42501, plus API-403). Ein 403
 * kommt hier stets als Klartext-Toast + Rollback (Liste neu laden) zurück.
 */
export const pflichtstundenDict = {
  de: {
    /* Kopf */
    pageTitle: "Pflichtstunden",
    pageSub: "Deine geleisteten Vereinsstunden — erfassen und im Blick behalten",
    logCta: "Stunden erfassen",

    /* Leerzustände & Fehler (Facade) */
    retry: "Wiederholen",
    loadErrorTitle: "Pflichtstunden konnten nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Meine Stunden (Soll/Ist) */
    mineTitle: "Meine Stunden",
    mineSub: "Dein Soll für die Saison und wie viel du schon geleistet hast",
    kpiSoll: "Soll",
    kpiIst: "Ist",
    kpiRest: "Rest",
    progressLabel: "{done} von {target} Stunden geleistet",
    fulfilledBadge: "Erfüllt",
    openBadge: "Offen",
    istApprovedNote: "davon {hours} genehmigt",
    pendingNote: "{n} Eintrag noch offen",
    pendingNotePlural: "{n} Einträge noch offen",
    sollNoneTitle: "Kein Soll hinterlegt",
    sollNoneBody: "Für dich ist derzeit keine Pflichtstunden-Regel aktiv. Erfasste Stunden zählst du trotzdem schon.",
    levelClub: "Vereinsregel",
    levelTeam: "Teamregel",
    levelMember: "persönliche Regel",

    /* Meine Einträge */
    listTitle: "Meine Einträge",
    listSub: "Alle von dir erfassten Stunden — neueste zuerst",
    listEmptyTitle: "Noch keine Stunden erfasst",
    listEmptyBody: "Trag deine erste geleistete Stunde ein — sie erscheint dann hier.",
    statusApproved: "Genehmigt",
    statusPending: "Offen",
    editAction: "Bearbeiten",
    deleteAction: "Löschen",
    noNote: "Ohne Notiz",

    /* Erfassen/Bearbeiten-Sheet */
    createEyebrow: "Stunden erfassen",
    createTitle: "Stunden erfassen",
    editEyebrow: "Eintrag bearbeiten",
    editTitle: "Eintrag bearbeiten",
    fDate: "Datum",
    fDateError: "Bitte ein gültiges Datum wählen (nicht in der Zukunft).",
    fHours: "Stunden",
    fHoursHint: "Dezimal möglich, z. B. 2,5 — in halben Stunden.",
    fHoursError: "Bitte eine Stundenzahl größer als 0 angeben.",
    fKind: "Art",
    fNote: "Notiz",
    fNotePlaceholder: "Was hast du gemacht? (optional)",
    cancel: "Abbrechen",
    create: "Erfassen",
    save: "Speichern",
    createdToast: "Stunden erfasst.",
    updatedToast: "Eintrag gespeichert.",
    forbidden: "Dafür fehlt dir die Berechtigung.",

    /* Löschen */
    deleteEyebrow: "Eintrag löschen",
    deleteTitle: "Eintrag löschen?",
    deleteBody: "Der erfasste Eintrag wird entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Eintrag löschen",
    deletedToast: "Eintrag gelöscht.",

    /* Offene Genehmigungen (Trainer:innen) */
    approvalsTitle: "Offene Genehmigungen",
    approvalsSub: "Von Mitgliedern erfasste Stunden, die auf deine Freigabe warten",
    approvalsEmptyTitle: "Alles freigegeben",
    approvalsEmptyBody: "Aktuell warten keine Einträge auf eine Genehmigung.",
    approveAction: "Genehmigen",
    approvedToast: "Eintrag genehmigt.",
    approveForbidden: "Nur Trainer:innen dürfen Stunden genehmigen.",
    byMember: "von {name}",

    /* Vereins-Übersicht (Trainer:innen) */
    overviewTitle: "Vereins-Übersicht",
    overviewSub: "Soll und Ist aller Mitglieder auf einen Blick",
    kpiTracked: "Mitglieder",
    kpiOpen: "Offen",
    kpiDone: "Erfüllt",
    filterAll: "Alle",
    filterOpen: "Offen",
    filterDone: "Erfüllt",
    filterLabel: "Übersicht nach Status filtern",
    overviewEmptyTitle: "Keine Mitglieder mit Soll",
    overviewEmptyBody: "Sobald eine Pflichtstunden-Regel gilt, erscheinen die Mitglieder hier.",
    filterEmptyTitle: "Nichts in diesem Status",
    filterEmptyBody: "Wähle einen anderen Status oder zeige alle an.",
    filterEmptyCta: "Alle anzeigen",
    noTeam: "Ohne Team",
    ofTarget: "{done} / {target}",
    unknownMember: "Unbekanntes Mitglied",
  },
  en: {
    /* Kopf */
    pageTitle: "Volunteer hours",
    pageSub: "Your logged club hours — track and keep an eye on them",
    logCta: "Log hours",

    /* Leerzustände & Fehler (Facade) */
    retry: "Retry",
    loadErrorTitle: "Volunteer hours could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Meine Stunden (Soll/Ist) */
    mineTitle: "My hours",
    mineSub: "Your target for the season and how much you have logged",
    kpiSoll: "Target",
    kpiIst: "Logged",
    kpiRest: "Remaining",
    progressLabel: "{done} of {target} hours completed",
    fulfilledBadge: "Met",
    openBadge: "Open",
    istApprovedNote: "{hours} approved",
    pendingNote: "{n} entry still open",
    pendingNotePlural: "{n} entries still open",
    sollNoneTitle: "No target set",
    sollNoneBody: "No volunteer-hours rule is currently active for you. Any hours you log still count.",
    levelClub: "club rule",
    levelTeam: "team rule",
    levelMember: "personal rule",

    /* Meine Einträge */
    listTitle: "My entries",
    listSub: "Every hour you have logged — newest first",
    listEmptyTitle: "No hours logged yet",
    listEmptyBody: "Log your first completed hour — it will show up here.",
    statusApproved: "Approved",
    statusPending: "Open",
    editAction: "Edit",
    deleteAction: "Delete",
    noNote: "No note",

    /* Erfassen/Bearbeiten-Sheet */
    createEyebrow: "Log hours",
    createTitle: "Log hours",
    editEyebrow: "Edit entry",
    editTitle: "Edit entry",
    fDate: "Date",
    fDateError: "Please pick a valid date (not in the future).",
    fHours: "Hours",
    fHoursHint: "Decimals allowed, e.g. 2.5 — in half hours.",
    fHoursError: "Please enter a number of hours greater than 0.",
    fKind: "Type",
    fNote: "Note",
    fNotePlaceholder: "What did you do? (optional)",
    cancel: "Cancel",
    create: "Log",
    save: "Save",
    createdToast: "Hours logged.",
    updatedToast: "Entry saved.",
    forbidden: "You don't have permission for this.",

    /* Löschen */
    deleteEyebrow: "Delete entry",
    deleteTitle: "Delete entry?",
    deleteBody: "The logged entry will be removed. This cannot be undone.",
    deleteConfirm: "Delete entry",
    deletedToast: "Entry deleted.",

    /* Offene Genehmigungen (Trainer:innen) */
    approvalsTitle: "Pending approvals",
    approvalsSub: "Hours logged by members that are waiting for your sign-off",
    approvalsEmptyTitle: "All approved",
    approvalsEmptyBody: "No entries are currently waiting for approval.",
    approveAction: "Approve",
    approvedToast: "Entry approved.",
    approveForbidden: "Only coaches may approve hours.",
    byMember: "by {name}",

    /* Vereins-Übersicht (Trainer:innen) */
    overviewTitle: "Club overview",
    overviewSub: "Target and logged hours for every member at a glance",
    kpiTracked: "Members",
    kpiOpen: "Open",
    kpiDone: "Met",
    filterAll: "All",
    filterOpen: "Open",
    filterDone: "Met",
    filterLabel: "Filter overview by status",
    overviewEmptyTitle: "No members with a target",
    overviewEmptyBody: "As soon as a volunteer-hours rule applies, members show up here.",
    filterEmptyTitle: "Nothing in this status",
    filterEmptyBody: "Pick a different status or show everyone.",
    filterEmptyCta: "Show all",
    noTeam: "No team",
    ofTarget: "{done} / {target}",
    unknownMember: "Unknown member",
  },
} satisfies Dict;

type DictKey = keyof (typeof pflichtstundenDict)["de"];

/** Anzeige-Reihenfolge der Arten im Auswahlfeld. */
export const DUTY_KIND_ORDER: readonly DutyKind[] = [
  "training",
  "helper",
  "competition",
  "other",
];

/** DutyKind → Badge-Ton (Farbe + Wort, nie nur Farbe). */
export const DUTY_KIND_TONE: Record<DutyKind, BadgeTone> = {
  training: "info",
  helper: "success",
  competition: "brand",
  other: "neutral",
};

/** Soll-Ebene → i18n-Schlüssel (für „gilt über die Vereinsregel" etc.). */
export const SOLL_LEVEL_KEY: Record<Exclude<SollLevel, "none">, DictKey> = {
  club: "levelClub",
  team: "levelTeam",
  member: "levelMember",
};
