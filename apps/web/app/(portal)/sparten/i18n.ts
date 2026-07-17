import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Sparten (Liste + Anlegen/Bearbeiten/
 * (De-)Aktivieren/Löschen). IMMER beide Sprachen vollständig, deutsche Strings
 * mit echten Umlauten.
 *
 * Rechte sind serverseitig (RLS + Rollencheck, Migration 0062–0064): Sparten
 * verwalten = can_manage_sparten (Super-Admin/owner/admin/treasurer, NICHT
 * moderator/coach/member); Lesen = jedes Mitglied. Die Sichtbarkeit der
 * Verwaltungs-Aktionen hier ist Komfort — ein 403 kommt als Klartext-Toast
 * + Rollback (Liste neu laden) zurück.
 */
export const spartenDict = {
  de: {
    /* Kopf */
    pageTitle: "Sparten",
    pageSub: "Die fachlichen Großbereiche deines Vereins — z. B. Rollkunstlauf und Eiskunstlauf",
    newSparte: "Sparte anlegen",

    /* Karte */
    activeBadge: "Aktiv",
    inactiveBadge: "Inaktiv",
    ownFinancesBadge: "Eigene Finanzen",
    memberCountOne: "{n} Mitglied",
    memberCountMany: "{n} Mitglieder",
    teamCountOne: "{n} Team",
    teamCountMany: "{n} Teams",
    editAction: "Bearbeiten",
    deleteAction: "Löschen",
    activateAction: "Aktivieren",
    deactivateAction: "Deaktivieren",

    /* Leerzustände & Fehler (Facade) */
    listEmptyTitle: "Noch keine Sparten",
    listEmptyBody: "Lege die erste Sparte deines Vereins an — z. B. Rollkunstlauf.",
    listEmptyMember: "Sobald die Vereinsleitung Sparten anlegt, erscheinen sie hier.",
    listEmptyCta: "Erste Sparte anlegen",
    retry: "Wiederholen",
    loadErrorTitle: "Sparten konnten nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Formular (Anlegen/Bearbeiten) */
    createEyebrow: "Neue Sparte",
    createTitle: "Sparte anlegen",
    editEyebrow: "Sparte",
    editTitle: "Sparte bearbeiten",
    fName: "Name",
    fNamePlaceholder: "z. B. Rollkunstlauf",
    fNameError: "Bitte einen Namen angeben.",
    fIcon: "Icon",
    fIconHint: "Symbol für Menü und Karte.",
    fColor: "Farbe",
    fColorHint: "Akzentfarbe der Sparte.",
    fActive: "Aktiv",
    fActiveHint: "Inaktive Sparten bleiben sichtbar, aber abgesetzt.",
    fSortOrder: "Reihenfolge",
    fSortOrderHint: "Kleinere Zahlen erscheinen zuerst (Standard 0).",
    fSortOrderError: "Bitte eine ganze Zahl ab 0 angeben.",
    fOwnFinances: "Eigene Finanzen / Beiträge",
    fOwnFinancesHint: "Die Sparte führt ihre Beiträge getrennt vom Verein.",
    fOwnFinancesOffHint: "Verfügbar, sobald das Finanz-Modul des Vereins aktiv ist.",
    cancel: "Abbrechen",
    save: "Speichern",
    create: "Anlegen",
    createdToast: "Sparte „{name}“ angelegt.",
    updatedToast: "Sparte „{name}“ gespeichert.",
    activatedToast: "Sparte „{name}“ aktiviert.",
    deactivatedToast: "Sparte „{name}“ deaktiviert.",
    forbidden: "Dafür fehlt dir die Berechtigung.",

    /* Löschen */
    deleteEyebrow: "Sparte löschen",
    deleteTitle: "„{name}“ löschen?",
    deleteBody:
      "Die Sparte wird entfernt. Die Mitglieder bleiben im Verein — nur ihre Zuordnung zu dieser Sparte entfällt. Zugeordnete Teams verlieren ihre Sparte.",
    deleteConfirm: "Löschen",
    deletedToast: "Sparte „{name}“ gelöscht.",
  },
  en: {
    /* Head */
    pageTitle: "Divisions",
    pageSub: "Your club's disciplines — e.g. artistic roller skating and figure skating",
    newSparte: "New division",

    /* Card */
    activeBadge: "Active",
    inactiveBadge: "Inactive",
    ownFinancesBadge: "Own finances",
    memberCountOne: "{n} member",
    memberCountMany: "{n} members",
    teamCountOne: "{n} team",
    teamCountMany: "{n} teams",
    editAction: "Edit",
    deleteAction: "Delete",
    activateAction: "Activate",
    deactivateAction: "Deactivate",

    /* Empty & error states (facade) */
    listEmptyTitle: "No divisions yet",
    listEmptyBody: "Create your club's first division — e.g. artistic roller skating.",
    listEmptyMember: "Once your club's admins add divisions, they'll show up here.",
    listEmptyCta: "Create first division",
    retry: "Retry",
    loadErrorTitle: "Divisions could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Form (create/edit) */
    createEyebrow: "New division",
    createTitle: "Create division",
    editEyebrow: "Division",
    editTitle: "Edit division",
    fName: "Name",
    fNamePlaceholder: "e.g. Artistic roller skating",
    fNameError: "Please enter a name.",
    fIcon: "Icon",
    fIconHint: "Symbol for menu and card.",
    fColor: "Colour",
    fColorHint: "Accent colour of the division.",
    fActive: "Active",
    fActiveHint: "Inactive divisions stay visible but set apart.",
    fSortOrder: "Order",
    fSortOrderHint: "Lower numbers appear first (default 0).",
    fSortOrderError: "Please enter a whole number of 0 or more.",
    fOwnFinances: "Own finances / fees",
    fOwnFinancesHint: "The division keeps its fees separate from the club.",
    fOwnFinancesOffHint: "Available once the club's finance module is active.",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    createdToast: "Division “{name}” created.",
    updatedToast: "Division “{name}” saved.",
    activatedToast: "Division “{name}” activated.",
    deactivatedToast: "Division “{name}” deactivated.",
    forbidden: "You don't have permission to do that.",

    /* Delete */
    deleteEyebrow: "Delete division",
    deleteTitle: "Delete “{name}”?",
    deleteBody:
      "The division will be removed. Members stay in the club — only their assignment to this division is cleared. Assigned teams lose their division.",
    deleteConfirm: "Delete",
    deletedToast: "Division “{name}” deleted.",
  },
} satisfies Dict;
