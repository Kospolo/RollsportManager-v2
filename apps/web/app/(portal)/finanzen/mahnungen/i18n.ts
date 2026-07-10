import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Mahnwesen-Screens (/finanzen/mahnungen,
 * Seriositätszone). DE und EN werden IMMER gemeinsam gepflegt — deutsche
 * Strings mit echten Umlauten ä/ö/ü/ß.
 *
 * Rechte SERVERSEITIG (RLS): Lesen und Schreiben = can_manage_finance
 * (treasurer/moderator/admin/owner). Die Sichtbarkeits-Gates hier sind nur
 * Anzeige — der Server bleibt die Wahrheit (403 ⇒ Toast). Stufe ≥ 2 wird
 * NIE automatisch versendet, nur mit ausdrücklicher Freigabe.
 */
export const mahnungenDict = {
  de: {
    // Kopf & Navigation
    crumbNav: "Brotkrumen",
    financeCrumb: "Finanzen",
    pageEyebrow: "Mahnwesen",
    pageTitle: "Mahnungen",
    pageSub: "Offene Posten nach Mahnstufe · Stand {date}",
    runButton: "Mahnlauf ausführen",

    // Laden & Fehler
    retry: "Erneut versuchen",
    loadErrorTitle: "Daten konnten nicht geladen werden",
    emptyTitle: "Keine offenen Posten",
    emptyBody:
      "Alle Rechnungen sind beglichen — für die Vereinskasse gibt es gerade nichts zu mahnen.",

    // Nur-Lese-Hinweis
    readOnlyNote:
      "Mahnungen auslösen dürfen nur Kassenwart und Vorstand (Finanzverwaltung). Du siehst diese Seite mit Leserechten — die Rechte setzt der Server durch.",

    // KPI-Zeile
    kpiOverdue: "Überfällig",
    kpiOverdueSub: "{n} offene Posten",
    kpiOverdueNone: "nichts überfällig",
    kpiDunning: "In Mahnung",
    kpiDunningSub: "Stufe 2+ · {sum}",
    kpiDunningNone: "keine aktive Mahnung",
    kpiHandover: "Übergabe empfohlen",
    kpiHandoverSub: "höchste Mahnstufe erreicht",
    kpiHandoverNone: "keine Übergabe fällig",

    // Mahnstufen-Gruppen (Ampel)
    stageEyebrow: "Mahnstufe {n}",
    stage0Title: "Offen — noch nicht gemahnt",
    stage1Title: "Erinnert",
    stage2Title: "1. Mahnung verschickt",
    stage3Title: "2. Mahnung — Übergabe empfohlen",
    stageMeta: "{n} Posten · {sum}",
    stageEmpty: "Keine Posten in dieser Stufe.",
    colMember: "Mitglied",
    colInvoice: "Rechnung",
    colDue: "Fällig",
    colAmount: "Betrag",
    memberSince: "dabei seit {year}",
    dueOverdueOne: "seit 1 Tag überfällig",
    dueOverdueMany: "seit {n} Tagen überfällig",
    previewMail: "E-Mail-Vorschau",
    previewMailAria: "Mahn-E-Mail für {name} ansehen",

    // Mahnprotokoll (Historie)
    historyEyebrow: "Mahnprotokoll",
    historyTitle: "Verlauf der Mahnungen",
    historyEmptyTitle: "Noch kein Eintrag",
    historyEmptyBody:
      "Sobald ein Mahnlauf angewendet wurde, erscheint hier jede Eskalation — unveränderlich (GoBD).",
    historyStage: "Stufe {from} → {to}",
    historyStageTo: "Stufe {to}",
    actionReminder: "Erinnerung",
    actionDunning: "Mahnung",
    actionHandover: "Übergabe",
    historyBy: "durch {name}",
    historySystem: "System",
    historyCount: "{n} Einträge",
    historyImmutable: "Unveränderlich — Korrektur nur per neuer Buchung (GoBD).",

    // Mahnlauf (Modal)
    runEyebrow: "Mahnlauf",
    runTitle: "Mahnlauf ausführen",
    runErrorTitle: "Vorschau konnte nicht geladen werden",
    runNoPermission: "Dafür fehlt dir die Berechtigung.",
    runEmptyTitle: "Nichts zu mahnen",
    runEmptyBody:
      "Es gibt keine überfälligen offenen Posten — die Vereinskasse ist auf Kurs.",
    previewOne: "1 überfälliger Posten geprüft",
    previewMany: "{n} überfällige Posten geprüft",
    dryBadge: "Vorschau — noch nichts versendet",

    routineTitle: "Zahlungserinnerung (Stufe 1)",
    routineHint: "Routine — wird beim Anwenden automatisch versendet.",
    routineEmpty: "Keine neue Erinnerung fällig.",

    approvalTitle: "Mahnung & Übergabe (Stufe 2+)",
    approvalHint: "Jede Eskalation braucht deine ausdrückliche Freigabe.",
    approvalEmpty: "Keine Eskalation vorgeschlagen.",
    approveAll: "Alle freigeben",
    approveOneAria: "Eskalation für {name} freigeben",
    approveWordOn: "Freigegeben",
    approveWordOff: "Gesperrt",

    targetReminder: "→ Erinnerung",
    targetDunning1: "→ 1. Mahnung",
    targetDunning2: "→ 2. Mahnung",
    targetHandover: "→ Übergabe an den Vorstand",

    noteLabel: "Notiz fürs Protokoll (optional)",
    notePlaceholder: "z. B. telefonisch angekündigt",

    cancel: "Abbrechen",
    applyButton: "Mahnlauf anwenden",
    applyingButton: "Wird angewendet …",
    runMicro:
      "Stufe 1 geht automatisch raus. Stufe 2+ nur mit Freigabe — der Server prüft es zusätzlich.",

    resultAppliedOne: "1 Mahnung versendet.",
    resultAppliedMany: "{n} Mahnungen versendet.",
    resultSkipped: "{n} übersprungen (bereits höchste Stufe oder nicht mehr offen).",
    resultNone: "Keine Mahnung versendet.",
    toastForbidden: "Keine Berechtigung — der Mahnlauf wurde serverseitig abgelehnt.",
  },
  en: {
    // Head & navigation
    crumbNav: "Breadcrumb",
    financeCrumb: "Finances",
    pageEyebrow: "Dunning",
    pageTitle: "Dunning",
    pageSub: "Open items by dunning stage · as of {date}",
    runButton: "Run dunning",

    // Loading & errors
    retry: "Try again",
    loadErrorTitle: "Data could not be loaded",
    emptyTitle: "No open items",
    emptyBody:
      "Every invoice is settled — there is nothing to dun for the club till right now.",

    // Read-only note
    readOnlyNote:
      "Only the treasurer and board (finance management) may trigger dunning. You see this page with read access — permissions are enforced by the server.",

    // KPI row
    kpiOverdue: "Overdue",
    kpiOverdueSub: "{n} open items",
    kpiOverdueNone: "nothing overdue",
    kpiDunning: "In dunning",
    kpiDunningSub: "stage 2+ · {sum}",
    kpiDunningNone: "no active dunning",
    kpiHandover: "Handover advised",
    kpiHandoverSub: "highest dunning stage reached",
    kpiHandoverNone: "no handover due",

    // Dunning stage groups (traffic light)
    stageEyebrow: "Dunning stage {n}",
    stage0Title: "Open — not yet dunned",
    stage1Title: "Reminded",
    stage2Title: "1st dunning sent",
    stage3Title: "2nd dunning — handover advised",
    stageMeta: "{n} items · {sum}",
    stageEmpty: "No items at this stage.",
    colMember: "Member",
    colInvoice: "Invoice",
    colDue: "Due",
    colAmount: "Amount",
    memberSince: "member since {year}",
    dueOverdueOne: "1 day overdue",
    dueOverdueMany: "{n} days overdue",
    previewMail: "E-mail preview",
    previewMailAria: "View dunning e-mail for {name}",

    // Dunning log (history)
    historyEyebrow: "Dunning log",
    historyTitle: "Dunning history",
    historyEmptyTitle: "No entry yet",
    historyEmptyBody:
      "As soon as a dunning run is applied, every escalation appears here — immutable (GoBD).",
    historyStage: "stage {from} → {to}",
    historyStageTo: "stage {to}",
    actionReminder: "Reminder",
    actionDunning: "Dunning notice",
    actionHandover: "Handover",
    historyBy: "by {name}",
    historySystem: "System",
    historyCount: "{n} entries",
    historyImmutable: "Immutable — corrections only via a new entry (GoBD).",

    // Dunning run (modal)
    runEyebrow: "Dunning run",
    runTitle: "Run dunning",
    runErrorTitle: "Preview could not be loaded",
    runNoPermission: "You do not have permission for this.",
    runEmptyTitle: "Nothing to dun",
    runEmptyBody: "There are no overdue open items — the club till is on track.",
    previewOne: "1 overdue item checked",
    previewMany: "{n} overdue items checked",
    dryBadge: "Preview — nothing sent yet",

    routineTitle: "Payment reminder (stage 1)",
    routineHint: "Routine — sent automatically when you apply.",
    routineEmpty: "No new reminder due.",

    approvalTitle: "Dunning & handover (stage 2+)",
    approvalHint: "Each escalation needs your explicit approval.",
    approvalEmpty: "No escalation proposed.",
    approveAll: "Approve all",
    approveOneAria: "Approve escalation for {name}",
    approveWordOn: "Approved",
    approveWordOff: "Locked",

    targetReminder: "→ reminder",
    targetDunning1: "→ 1st dunning",
    targetDunning2: "→ 2nd dunning",
    targetHandover: "→ handover to the board",

    noteLabel: "Note for the log (optional)",
    notePlaceholder: "e.g. announced by phone",

    cancel: "Cancel",
    applyButton: "Apply dunning run",
    applyingButton: "Applying …",
    runMicro:
      "Stage 1 goes out automatically. Stage 2+ only with approval — the server checks it too.",

    resultAppliedOne: "1 dunning sent.",
    resultAppliedMany: "{n} dunnings sent.",
    resultSkipped: "{n} skipped (already at the highest stage or no longer open).",
    resultNone: "No dunning sent.",
    toastForbidden: "No permission — the dunning run was rejected server-side.",
  },
} satisfies Dict;

export type MahnungenKey = keyof (typeof mahnungenDict)["de"];
