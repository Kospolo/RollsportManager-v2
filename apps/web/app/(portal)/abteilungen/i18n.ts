import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Abteilungen (Liste + Anlegen/Bearbeiten/Löschen
 * + Mitglieder-Zuordnung). IMMER beide Sprachen vollständig, deutsche Strings mit
 * echten Umlauten.
 *
 * Rechte sind serverseitig (RLS + Rollencheck): Abteilungen anlegen/ändern/löschen
 * = is_club_admin; Mitglieder-Roster setzen = is_club_trainer; Lesen = is_club_member.
 * Sichtbarkeit hier ist Komfort — ein 403 kommt stets als Klartext-Toast + Rollback
 * (Liste neu laden) zurück.
 */
export const abteilungenDict = {
  de: {
    /* Kopf */
    pageTitle: "Abteilungen",
    pageSub: "Die Abteilungen deines Vereins — Leitung, Mitglieder und Zuordnung",
    newDepartment: "Abteilung anlegen",

    /* Karte */
    leadLabel: "Leitung",
    noLead: "Keine Leitung",
    memberCountOne: "{n} Mitglied",
    memberCountMany: "{n} Mitglieder",
    noMembers: "Noch keine Mitglieder",
    openMembers: "Mitglieder ansehen",
    editAction: "Bearbeiten",
    deleteAction: "Löschen",

    /* Leerzustände & Fehler (Facade) */
    listEmptyTitle: "Noch keine Abteilungen",
    listEmptyBody: "Lege die erste Abteilung deines Vereins an.",
    listEmptyMember: "Sobald die Vereinsleitung Abteilungen anlegt, erscheinen sie hier.",
    listEmptyCta: "Erste Abteilung anlegen",
    retry: "Wiederholen",
    loadErrorTitle: "Abteilungen konnten nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Formular (Anlegen/Bearbeiten) */
    createEyebrow: "Neue Abteilung",
    createTitle: "Abteilung anlegen",
    editEyebrow: "Abteilung",
    editTitle: "Abteilung bearbeiten",
    fName: "Name",
    fNamePlaceholder: "z. B. Rollkunstlauf",
    fNameError: "Bitte einen Namen angeben.",
    fDescription: "Beschreibung",
    fDescriptionPlaceholder: "Optional — worum geht es in dieser Abteilung?",
    fLead: "Leitung",
    fLeadHint: "Verantwortliche:r für diese Abteilung.",
    leadNone: "— keine —",
    fSortOrder: "Reihenfolge",
    fSortOrderHint: "Kleinere Zahlen erscheinen zuerst (Standard 0).",
    fSortOrderError: "Bitte eine ganze Zahl ab 0 angeben.",
    cancel: "Abbrechen",
    save: "Speichern",
    create: "Anlegen",
    createdToast: "Abteilung „{name}“ angelegt.",
    updatedToast: "Abteilung „{name}“ gespeichert.",
    forbidden: "Dafür fehlt dir die Berechtigung.",

    /* Löschen */
    deleteEyebrow: "Abteilung löschen",
    deleteTitle: "„{name}“ löschen?",
    deleteBody:
      "Die Abteilung wird entfernt. Die Mitglieder bleiben im Verein — nur ihre Zuordnung zu dieser Abteilung entfällt.",
    deleteConfirm: "Löschen",
    deletedToast: "Abteilung „{name}“ gelöscht.",

    /* Mitglieder-Sheet */
    membersEyebrow: "Abteilung",
    membersTitle: "Mitglieder — {name}",
    membersReadHint: "Diese Mitglieder gehören aktuell zur Abteilung.",
    membersEmpty: "Dieser Abteilung sind noch keine Mitglieder zugeordnet.",
    assignHint: "Wähle die Mitglieder aus, die zu dieser Abteilung gehören sollen.",
    noClubMembers: "Es gibt noch keine Mitglieder im Verein.",
    searchLabel: "Mitglieder durchsuchen",
    searchPlaceholder: "Name suchen …",
    searchEmpty: "Keine Mitglieder gefunden.",
    selectedSummaryOne: "{n} Mitglied ausgewählt",
    selectedSummaryMany: "{n} Mitglieder ausgewählt",
    saveRoster: "Zuordnung speichern",
    rosterSavedToast: "Mitglieder der Abteilung „{name}“ gespeichert.",
  },
  en: {
    /* Head */
    pageTitle: "Departments",
    pageSub: "Your club's departments — lead, members and assignment",
    newDepartment: "New department",

    /* Card */
    leadLabel: "Lead",
    noLead: "No lead",
    memberCountOne: "{n} member",
    memberCountMany: "{n} members",
    noMembers: "No members yet",
    openMembers: "View members",
    editAction: "Edit",
    deleteAction: "Delete",

    /* Empty & error states (facade) */
    listEmptyTitle: "No departments yet",
    listEmptyBody: "Create your club's first department.",
    listEmptyMember: "Once your club's admins add departments, they'll show up here.",
    listEmptyCta: "Create first department",
    retry: "Retry",
    loadErrorTitle: "Departments could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Form (create/edit) */
    createEyebrow: "New department",
    createTitle: "Create department",
    editEyebrow: "Department",
    editTitle: "Edit department",
    fName: "Name",
    fNamePlaceholder: "e.g. Artistic roller skating",
    fNameError: "Please enter a name.",
    fDescription: "Description",
    fDescriptionPlaceholder: "Optional — what is this department about?",
    fLead: "Lead",
    fLeadHint: "Person responsible for this department.",
    leadNone: "— none —",
    fSortOrder: "Order",
    fSortOrderHint: "Lower numbers appear first (default 0).",
    fSortOrderError: "Please enter a whole number of 0 or more.",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    createdToast: "Department “{name}” created.",
    updatedToast: "Department “{name}” saved.",
    forbidden: "You don't have permission to do that.",

    /* Delete */
    deleteEyebrow: "Delete department",
    deleteTitle: "Delete “{name}”?",
    deleteBody:
      "The department will be removed. Members stay in the club — only their assignment to this department is cleared.",
    deleteConfirm: "Delete",
    deletedToast: "Department “{name}” deleted.",

    /* Members sheet */
    membersEyebrow: "Department",
    membersTitle: "Members — {name}",
    membersReadHint: "These members currently belong to the department.",
    membersEmpty: "No members are assigned to this department yet.",
    assignHint: "Pick the members that should belong to this department.",
    noClubMembers: "There are no members in the club yet.",
    searchLabel: "Search members",
    searchPlaceholder: "Search name …",
    searchEmpty: "No members found.",
    selectedSummaryOne: "{n} member selected",
    selectedSummaryMany: "{n} members selected",
    saveRoster: "Save assignment",
    rosterSavedToast: "Members of department “{name}” saved.",
  },
} satisfies Dict;
