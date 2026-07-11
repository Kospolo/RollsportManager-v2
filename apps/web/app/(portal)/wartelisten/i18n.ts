import type { Dict } from "@/lib/i18n";
import type { WaitlistKind, WaitlistStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary für die Wartelisten. Regel: JEDER String in beiden
 * Sprachen, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 *
 * Zwei Sichten in einem Screen, abgeleitet aus der (RLS-gescopten) Response:
 * „Meine Einträge" (Selbst-Eintrag/-Austrag) sieht jede:r; die
 * „Vereins-Warteschlange" mit Status-Aktionen ist Trainer+ vorbehalten. Die
 * verbindliche Durchsetzung bleibt serverseitig — ein 403 wird als Klartext-Toast
 * behandelt.
 */
export const wartelistenDict = {
  de: {
    title: "Wartelisten",
    sub: "Trag dich für Hallen, Ausrüstung, Teams und Termine ein — und behalte deine Plätze im Blick.",
    joinCta: "Eintragen",

    // Arten
    kindFacility: "Halle",
    kindEquipment: "Ausrüstung",
    kindTeam: "Team",
    kindEvent: "Termin",

    // Status
    statusWaiting: "Warten",
    statusOffered: "Angebot",
    statusFulfilled: "Erfüllt",
    statusCancelled: "Storniert",

    // Meine Einträge
    mineTitle: "Meine Wartelisten-Einträge",
    mineCount: "{n} Einträge",
    mineEmptyTitle: "Du stehst auf keiner Warteliste",
    mineEmptyBody:
      "Trag dich für Hallenzeiten, Ausrüstung, Teams oder Termine ein — deine Plätze erscheinen dann hier.",
    leaveCta: "Austragen",
    joinedOn: "Eingetragen {date}",

    // Vereins-Warteschlange (Trainer+)
    queueTitle: "Vereins-Warteschlange",
    queueSub: "Alle Einträge des Vereins — Angebote machen und erfüllen.",
    queueEmptyTitle: "Keine Einträge in der Warteschlange",
    queueEmptyBody: "Sobald sich Mitglieder eintragen, erscheinen ihre Plätze hier.",
    filterAll: "Alle",
    filterLabel: "Warteschlange nach Art filtern",
    filterEmptyTitle: "Keine Einträge dieser Art",
    filterEmptyBody: "Für die gewählte Art steht gerade niemand auf der Warteliste.",
    filterEmptyCta: "Filter zurücksetzen",

    // Ziel
    targetGeneral: "Allgemein",
    targetUnknown: "Ziel",

    // Aktionen (Trainer+)
    actOffer: "Angebot machen",
    actFulfil: "Erfüllen",
    actReopen: "Wieder öffnen",
    actWithdraw: "Angebot zurücknehmen",
    actRemove: "Entfernen",

    // Toasts
    joinedToast: "Auf die Warteliste gesetzt.",
    leftToast: "Von der Warteliste entfernt.",
    statusToast: "Status aktualisiert.",
    forbiddenJoin: "Du kannst dich nur selbst eintragen.",
    forbiddenManage: "Dafür fehlt dir die Berechtigung (nur Trainer:innen).",

    // Ladezustände
    retry: "Erneut versuchen",
    loadErrorTitle: "Wartelisten konnten nicht geladen werden",
    loadErrorBody: "Bitte versuch es gleich noch einmal.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Die Wartelisten haben im api-Modus noch keinen Endpoint.",

    // Eintragen-Dialog
    joinEyebrow: "Warteliste",
    joinTitle: "In eine Warteliste eintragen",
    fKind: "Art",
    fTarget: "Ziel",
    fTargetGeneral: "Allgemein (kein bestimmtes Ziel)",
    fTargetUnavailable:
      "Für diese Art sind gerade keine Ziele hinterlegt — du kannst dich allgemein eintragen.",
    fNote: "Notiz (optional)",
    fNotePlaceholder: "Wunsch oder Grund kurz beschreiben …",
    cancel: "Abbrechen",
    submitJoin: "Eintragen",

    // Austragen/Entfernen-Dialog
    leaveEyebrow: "Warteliste",
    leaveTitle: "Von der Warteliste austragen?",
    leaveTitleTrainer: "Eintrag entfernen?",
    leaveBody: "Dein Platz in dieser Warteliste geht dabei verloren.",
    leaveBodyTrainer: "Der Eintrag von {name} wird aus der Warteschlange entfernt.",
    leaveConfirm: "Austragen",
    removeConfirm: "Entfernen",
  },
  en: {
    title: "Waitlists",
    sub: "Join for facilities, equipment, teams and events — and keep an eye on your spots.",
    joinCta: "Join",

    // Kinds
    kindFacility: "Facility",
    kindEquipment: "Equipment",
    kindTeam: "Team",
    kindEvent: "Event",

    // Status
    statusWaiting: "Waiting",
    statusOffered: "Offered",
    statusFulfilled: "Fulfilled",
    statusCancelled: "Cancelled",

    // My entries
    mineTitle: "My waitlist entries",
    mineCount: "{n} entries",
    mineEmptyTitle: "You're not on any waitlist",
    mineEmptyBody:
      "Join for facility slots, equipment, teams or events — your spots then appear here.",
    leaveCta: "Leave",
    joinedOn: "Joined {date}",

    // Club queue (trainer+)
    queueTitle: "Club waitlist queue",
    queueSub: "All club entries — make and fulfil offers.",
    queueEmptyTitle: "No entries in the queue",
    queueEmptyBody: "As soon as members join, their spots appear here.",
    filterAll: "All",
    filterLabel: "Filter the queue by type",
    filterEmptyTitle: "No entries of this type",
    filterEmptyBody: "Nobody is on the waitlist for the selected type right now.",
    filterEmptyCta: "Reset filter",

    // Target
    targetGeneral: "General",
    targetUnknown: "Target",

    // Actions (trainer+)
    actOffer: "Make offer",
    actFulfil: "Fulfil",
    actReopen: "Reopen",
    actWithdraw: "Withdraw offer",
    actRemove: "Remove",

    // Toasts
    joinedToast: "Added to the waitlist.",
    leftToast: "Removed from the waitlist.",
    statusToast: "Status updated.",
    forbiddenJoin: "You can only add yourself.",
    forbiddenManage: "You don't have permission for that (trainers only).",

    // Loading states
    retry: "Try again",
    loadErrorTitle: "Waitlists could not be loaded",
    loadErrorBody: "Please try again in a moment.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "Waitlists have no endpoint in api mode yet.",

    // Join dialog
    joinEyebrow: "Waitlist",
    joinTitle: "Join a waitlist",
    fKind: "Type",
    fTarget: "Target",
    fTargetGeneral: "General (no specific target)",
    fTargetUnavailable:
      "No targets available for this type right now — you can join generally.",
    fNote: "Note (optional)",
    fNotePlaceholder: "Briefly describe your wish or reason …",
    cancel: "Cancel",
    submitJoin: "Join",

    // Leave/remove dialog
    leaveEyebrow: "Waitlist",
    leaveTitle: "Leave the waitlist?",
    leaveTitleTrainer: "Remove entry?",
    leaveBody: "Your spot in this waitlist will be lost.",
    leaveBodyTrainer: "{name}'s entry will be removed from the queue.",
    leaveConfirm: "Leave",
    removeConfirm: "Remove",
  },
} satisfies Dict;

export type WartelistenKey = keyof (typeof wartelistenDict)["de"];

/** Art → Dictionary-Key des Labels. */
export const KIND_KEY: Record<WaitlistKind, WartelistenKey> = {
  facility: "kindFacility",
  equipment: "kindEquipment",
  team: "kindTeam",
  event: "kindEvent",
};

/** Status → Dictionary-Key des Labels. */
export const STATUS_KEY: Record<WaitlistStatus, WartelistenKey> = {
  waiting: "statusWaiting",
  offered: "statusOffered",
  fulfilled: "statusFulfilled",
  cancelled: "statusCancelled",
};

/** Stabile Anzeige-Reihenfolge der Arten (Filter + Gruppierung). */
export const KIND_ORDER: WaitlistKind[] = ["facility", "equipment", "team", "event"];

/** Status-Reihenfolge fürs Sortieren (aktiv zuerst, erledigt zuletzt). */
export const STATUS_ORDER: WaitlistStatus[] = ["offered", "waiting", "fulfilled", "cancelled"];
