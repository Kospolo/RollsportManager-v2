import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Gruppen (Liste + Anlegen/Bearbeiten/Löschen
 * + Mitglieder-Zuordnung). IMMER beide Sprachen vollständig, deutsche Strings mit
 * echten Umlauten.
 *
 * HINWEIS: Der fachliche Begriff (DB/Route/Facade) bleibt „department"; sichtbar
 * heißt er im UI „Gruppe(n)". Nur die Beschriftungen wurden umbenannt, keine Logik.
 *
 * Rechte sind serverseitig (RLS + Rollencheck): Gruppen anlegen/ändern/löschen
 * = is_club_admin; Mitglieder-Roster setzen = is_club_trainer; Lesen = is_club_member.
 * Sichtbarkeit hier ist Komfort — ein 403 kommt stets als Klartext-Toast + Rollback
 * (Liste neu laden) zurück.
 */
export const abteilungenDict = {
  de: {
    /* Kopf */
    pageTitle: "Gruppen",
    pageSub: "Die Gruppen deines Vereins — Leitung, Mitglieder und Zuordnung",
    newDepartment: "Gruppe anlegen",

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
    listEmptyTitle: "Noch keine Gruppen",
    listEmptyBody: "Lege die erste Gruppe deines Vereins an.",
    listEmptyMember: "Sobald die Vereinsleitung Gruppen anlegt, erscheinen sie hier.",
    listEmptyCta: "Erste Gruppe anlegen",
    retry: "Wiederholen",
    loadErrorTitle: "Gruppen konnten nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Formular (Anlegen/Bearbeiten) */
    createEyebrow: "Neue Gruppe",
    createTitle: "Gruppe anlegen",
    editEyebrow: "Gruppe",
    editTitle: "Gruppe bearbeiten",
    fName: "Name",
    fNamePlaceholder: "z. B. Rollkunstlauf",
    fNameError: "Bitte einen Namen angeben.",
    fDescription: "Beschreibung",
    fDescriptionPlaceholder: "Optional — worum geht es in dieser Gruppe?",
    fLead: "Leitung",
    fLeadHint: "Verantwortliche:r für diese Gruppe.",
    leadNone: "— keine —",
    fSortOrder: "Reihenfolge",
    fSortOrderHint: "Kleinere Zahlen erscheinen zuerst (Standard 0).",
    fSortOrderError: "Bitte eine ganze Zahl ab 0 angeben.",
    cancel: "Abbrechen",
    save: "Speichern",
    create: "Anlegen",
    createdToast: "Gruppe „{name}“ angelegt.",
    updatedToast: "Gruppe „{name}“ gespeichert.",
    forbidden: "Dafür fehlt dir die Berechtigung.",

    /* Löschen */
    deleteEyebrow: "Gruppe löschen",
    deleteTitle: "„{name}“ löschen?",
    deleteBody:
      "Die Gruppe wird entfernt. Die Mitglieder bleiben im Verein — nur ihre Zuordnung zu dieser Gruppe entfällt.",
    deleteConfirm: "Löschen",
    deletedToast: "Gruppe „{name}“ gelöscht.",

    /* Mitglieder-Sheet */
    membersEyebrow: "Gruppe",
    membersTitle: "Mitglieder — {name}",
    membersReadHint: "Diese Mitglieder gehören aktuell zur Gruppe.",
    membersEmpty: "Dieser Gruppe sind noch keine Mitglieder zugeordnet.",
    assignHint: "Wähle die Mitglieder aus, die zu dieser Gruppe gehören sollen.",
    noClubMembers: "Es gibt noch keine Mitglieder im Verein.",
    searchLabel: "Mitglieder durchsuchen",
    searchPlaceholder: "Name suchen …",
    searchEmpty: "Keine Mitglieder gefunden.",
    selectedSummaryOne: "{n} Mitglied ausgewählt",
    selectedSummaryMany: "{n} Mitglieder ausgewählt",
    saveRoster: "Zuordnung speichern",
    rosterSavedToast: "Mitglieder der Gruppe „{name}“ gespeichert.",
  },
  en: {
    /* Head */
    pageTitle: "Groups",
    pageSub: "Your club's groups — lead, members and assignment",
    newDepartment: "New group",

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
    listEmptyTitle: "No groups yet",
    listEmptyBody: "Create your club's first group.",
    listEmptyMember: "Once your club's admins add groups, they'll show up here.",
    listEmptyCta: "Create first group",
    retry: "Retry",
    loadErrorTitle: "Groups could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Form (create/edit) */
    createEyebrow: "New group",
    createTitle: "Create group",
    editEyebrow: "Group",
    editTitle: "Edit group",
    fName: "Name",
    fNamePlaceholder: "e.g. Artistic roller skating",
    fNameError: "Please enter a name.",
    fDescription: "Description",
    fDescriptionPlaceholder: "Optional — what is this group about?",
    fLead: "Lead",
    fLeadHint: "Person responsible for this group.",
    leadNone: "— none —",
    fSortOrder: "Order",
    fSortOrderHint: "Lower numbers appear first (default 0).",
    fSortOrderError: "Please enter a whole number of 0 or more.",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    createdToast: "Group “{name}” created.",
    updatedToast: "Group “{name}” saved.",
    forbidden: "You don't have permission to do that.",

    /* Delete */
    deleteEyebrow: "Delete group",
    deleteTitle: "Delete “{name}”?",
    deleteBody:
      "The group will be removed. Members stay in the club — only their assignment to this group is cleared.",
    deleteConfirm: "Delete",
    deletedToast: "Group “{name}” deleted.",

    /* Members sheet */
    membersEyebrow: "Group",
    membersTitle: "Members — {name}",
    membersReadHint: "These members currently belong to the group.",
    membersEmpty: "No members are assigned to this group yet.",
    assignHint: "Pick the members that should belong to this group.",
    noClubMembers: "There are no members in the club yet.",
    searchLabel: "Search members",
    searchPlaceholder: "Search name …",
    searchEmpty: "No members found.",
    selectedSummaryOne: "{n} member selected",
    selectedSummaryMany: "{n} members selected",
    saveRoster: "Save assignment",
    rosterSavedToast: "Members of group “{name}” saved.",
  },
} satisfies Dict;
