import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary für den Chat (Team-Kanäle + Direktnachrichten).
 * Rechte sind SERVERSEITIG (RLS, Referenz 1.3): Team-Kanal posten = NUR
 * Team-Mitglied, Direktnachricht = nur Sender+Empfänger, eigene Nachrichten
 * löschbar. Die UI gatet nur zur Anzeige. Regel: JEDER String in beiden
 * Sprachen, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 */
export const chatDict = {
  de: {
    title: "Nachrichten",
    sub: "Team-Kanäle und Direktnachrichten deines Vereins",
    refresh: "Aktualisieren",

    // Kanalliste (links)
    channelsHeading: "Unterhaltungen",
    teamChannel: "Team-Kanal",
    directMessage: "Direktnachricht",
    previewYou: "Du: {text}",
    previewOther: "{name}: {text}",
    imageMessage: "Bild",
    noMessagesYet: "Noch keine Nachrichten",
    listEmptyTitle: "Keine Unterhaltungen",
    listEmptyBody:
      "Sobald du einem Team angehörst oder eine Direktnachricht bekommst, erscheinen deine Unterhaltungen hier.",
    channelsErrorTitle: "Unterhaltungen konnten nicht geladen werden",
    channelsErrorBody:
      "Deine Unterhaltungen ließen sich gerade nicht laden — bitte erneut versuchen.",

    // Thread (rechts)
    pickChannelTitle: "Unterhaltung wählen",
    pickChannelBody: "Wähle links eine Unterhaltung, um die Nachrichten zu lesen.",
    back: "Zurück",
    backToList: "Zurück zur Kanalliste",
    threadEmptyTitle: "Noch keine Nachrichten",
    threadEmptyBodyTeam: "Sei die erste Person, die in diesem Team-Kanal schreibt.",
    threadEmptyBodyDirect: "Schreib die erste Nachricht an {name}.",
    loadErrorTitle: "Nachrichten konnten nicht geladen werden",
    loadErrorBody: "Die Nachrichten ließen sich gerade nicht laden — bitte erneut versuchen.",
    retry: "Erneut versuchen",

    // Verfassen
    inputLabel: "Nachricht schreiben",
    inputPlaceholder: "Nachricht schreiben …",
    send: "Senden",
    sendHint: "Enter sendet · Umschalt+Enter für eine neue Zeile",
    sendError: "Nachricht konnte nicht gesendet werden — bitte erneut versuchen.",

    // Bild-Anhang
    attach: "Bild anhängen",
    attachedImage: "Angehängtes Bild",
    removeImage: "Bild entfernen",
    imageUploadError: "Bild konnte nicht hochgeladen werden — bitte erneut versuchen.",
    imageTypeError: "Bitte eine Bilddatei auswählen.",
    imageTooLargeError: "Das Bild ist zu groß (max. 10 MB).",

    // Blase
    you: "Du",
    delete: "Löschen",
    imageAlt: "Bild in der Nachricht",
    imageFailed: "Bild nicht verfügbar",

    // Löschen (Bestätigung)
    deleteEyebrow: "Nachricht löschen",
    deleteTitle: "Nachricht löschen?",
    deleteBody: "Die Nachricht wird endgültig entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Nachricht löschen",
    cancel: "Abbrechen",
    deletedToast: "Nachricht gelöscht",
    genericError: "Etwas ist schiefgelaufen — bitte erneut versuchen.",
  },
  en: {
    title: "Messages",
    sub: "Team channels and direct messages in your club",
    refresh: "Refresh",

    channelsHeading: "Conversations",
    teamChannel: "Team channel",
    directMessage: "Direct message",
    previewYou: "You: {text}",
    previewOther: "{name}: {text}",
    imageMessage: "Image",
    noMessagesYet: "No messages yet",
    listEmptyTitle: "No conversations",
    listEmptyBody:
      "As soon as you belong to a team or receive a direct message, your conversations appear here.",
    channelsErrorTitle: "Conversations could not be loaded",
    channelsErrorBody: "Your conversations could not be loaded right now — please try again.",

    pickChannelTitle: "Choose a conversation",
    pickChannelBody: "Pick a conversation on the left to read its messages.",
    back: "Back",
    backToList: "Back to channel list",
    threadEmptyTitle: "No messages yet",
    threadEmptyBodyTeam: "Be the first to post in this team channel.",
    threadEmptyBodyDirect: "Send the first message to {name}.",
    loadErrorTitle: "Messages could not be loaded",
    loadErrorBody: "The messages could not be loaded right now — please try again.",
    retry: "Try again",

    inputLabel: "Write a message",
    inputPlaceholder: "Write a message …",
    send: "Send",
    sendHint: "Enter to send · Shift+Enter for a new line",
    sendError: "The message could not be sent — please try again.",

    // Image attachment
    attach: "Attach image",
    attachedImage: "Attached image",
    removeImage: "Remove image",
    imageUploadError: "The image could not be uploaded — please try again.",
    imageTypeError: "Please choose an image file.",
    imageTooLargeError: "The image is too large (max. 10 MB).",

    you: "You",
    delete: "Delete",
    imageAlt: "Image in message",
    imageFailed: "Image unavailable",

    deleteEyebrow: "Delete message",
    deleteTitle: "Delete message?",
    deleteBody: "The message will be removed permanently. This cannot be undone.",
    deleteConfirm: "Delete message",
    cancel: "Cancel",
    deletedToast: "Message deleted",
    genericError: "Something went wrong — please try again.",
  },
} satisfies Dict;

export type ChatKey = keyof (typeof chatDict)["de"];
