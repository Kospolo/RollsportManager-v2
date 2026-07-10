import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des Neuigkeiten-Screens (Schwarzes Brett).
 * Regel: JEDE Ergänzung in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß) — nie ae/oe/ue/ss.
 */
export const newsDict = {
  de: {
    pageEyebrow: "Schwarzes Brett",
    pageTitle: "Neuigkeiten",
    pageSub: "Ankündigungen und Infos für den ganzen Verein",
    compose: "Nachricht verfassen",

    pinnedTitle: "Angepinnt",
    moreTitle: "Weitere Neuigkeiten",
    pinnedBadge: "Angepinnt",
    draftBadge: "Entwurf",
    byAuthor: "von {name}",
    unknownAuthor: "Unbekannt",
    openAria: "Neuigkeit öffnen: {title}",
    edit: "Bearbeiten",
    delete: "Löschen",
    editAria: "Neuigkeit bearbeiten: {title}",
    deleteAria: "Neuigkeit löschen: {title}",
    relative: "vor {days}",

    emptyTitle: "Noch keine Neuigkeiten",
    emptyBodyTrainer:
      "Verfasse die erste Nachricht — sie erscheint sofort auf dem Schwarzen Brett aller Mitglieder.",
    emptyBodyMember: "Sobald der Trainerstab etwas postet, erscheint es hier.",
    emptyCta: "Erste Nachricht verfassen",

    loadErrorTitle: "Neuigkeiten konnten nicht geladen werden",
    loadErrorRetry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
    noPermission: "Keine Berechtigung für diese Aktion",
    retry: "Wiederholen",

    detailEyebrow: "Neuigkeit",

    formEyebrowCreate: "Neue Nachricht",
    formTitleCreate: "Nachricht verfassen",
    formEyebrowEdit: "Nachricht bearbeiten",
    formTitleEdit: "Nachricht bearbeiten",
    fTitle: "Titel",
    fTitlePh: "z. B. Neue Trainingszeiten ab Montag",
    fBody: "Text",
    fBodyPh: "Worum geht es? Schreibe die Nachricht in ganzen Sätzen …",
    fPin: "Oben anpinnen",
    fPinHint: "Angepinnte Nachrichten stehen immer ganz oben auf dem Brett.",
    pinOn: "Angepinnt",
    pinOff: "Normal",
    errTitle: "Bitte gib einen Titel an.",
    errBody: "Bitte schreibe einen Text.",
    submitCreate: "Veröffentlichen",
    submitEdit: "Änderungen speichern",
    cancel: "Abbrechen",
    createdToast: "Nachricht „{title}“ ist veröffentlicht",
    updatedToast: "Nachricht „{title}“ ist aktualisiert",

    deleteEyebrow: "Löschen bestätigen",
    deleteTitle: "„{title}“ löschen?",
    deleteBody:
      "Die Nachricht wird für alle Mitglieder vom Schwarzen Brett entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Endgültig löschen",
    deletedToast: "Nachricht gelöscht",
  },
  en: {
    pageEyebrow: "Notice board",
    pageTitle: "News",
    pageSub: "Announcements and info for the whole club",
    compose: "Write message",

    pinnedTitle: "Pinned",
    moreTitle: "More news",
    pinnedBadge: "Pinned",
    draftBadge: "Draft",
    byAuthor: "by {name}",
    unknownAuthor: "Unknown",
    openAria: "Open news item: {title}",
    edit: "Edit",
    delete: "Delete",
    editAria: "Edit news item: {title}",
    deleteAria: "Delete news item: {title}",
    relative: "{days} ago",

    emptyTitle: "No news yet",
    emptyBodyTrainer:
      "Write the first message — it appears on every member's notice board right away.",
    emptyBodyMember: "As soon as a coach posts something, it shows up here.",
    emptyCta: "Write the first message",

    loadErrorTitle: "News could not be loaded",
    loadErrorRetry: "Try again",
    niTitle: "Not connected yet",
    niBody: "This area has no endpoint in api mode yet.",
    noPermission: "No permission for this action",
    retry: "Retry",

    detailEyebrow: "News item",

    formEyebrowCreate: "New message",
    formTitleCreate: "Write message",
    formEyebrowEdit: "Edit message",
    formTitleEdit: "Edit message",
    fTitle: "Title",
    fTitlePh: "e.g. New training times from Monday",
    fBody: "Text",
    fBodyPh: "What is it about? Write the message in full sentences …",
    fPin: "Pin to top",
    fPinHint: "Pinned messages always stay at the very top of the board.",
    pinOn: "Pinned",
    pinOff: "Normal",
    errTitle: "Please enter a title.",
    errBody: "Please write a text.",
    submitCreate: "Publish",
    submitEdit: "Save changes",
    cancel: "Cancel",
    createdToast: "Message “{title}” published",
    updatedToast: "Message “{title}” updated",

    deleteEyebrow: "Confirm deletion",
    deleteTitle: "Delete “{title}”?",
    deleteBody:
      "The message will be removed from every member's notice board. This cannot be undone.",
    deleteConfirm: "Delete permanently",
    deletedToast: "Message deleted",
  },
} satisfies Dict;
