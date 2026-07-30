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
    // Leer, weil in KEINEM Team — der häufigste Fall beim Vorstand. Erklärt den
    // Grund und zeigt den Weg, statt nur leer zu sein.
    listEmptyNoTeamTitle: "Du bist in keinem Team",
    listEmptyNoTeamBody:
      "Team-Kanäle siehst du, sobald du selbst zu einem Team gehörst — den Chat deiner Teams liest du also nur als Teil davon. Direktnachrichten kannst du jederzeit anfangen.",
    channelsErrorTitle: "Unterhaltungen konnten nicht geladen werden",
    channelsErrorBody:
      "Deine Unterhaltungen ließen sich gerade nicht laden — bitte erneut versuchen.",

    // Neue Direktnachricht (Empfängerauswahl)
    newMessage: "Neue Nachricht",
    newMessageTitle: "Neue Nachricht an …",
    newMessageEyebrow: "Direktnachricht",
    searchLabel: "Person suchen",
    searchPlaceholder: "Name suchen …",
    recipientsLoadError: "Die Auswahl ließ sich gerade nicht laden — bitte erneut versuchen.",
    recipientsEmptyTitle: "Niemand zum Anschreiben",
    recipientsEmptyBody: "Aktuell kannst du niemanden neu anschreiben.",
    recipientsNoHitTitle: "Kein Treffer",
    recipientsNoHitBody: "Zu „{query}“ passt niemand aus deiner Auswahl.",
    // Erklärt, WARUM die Liste kürzer ist als die Mitgliederliste. Ohne diesen
    // Satz wirkt die Kinderschutz-Regel wie ein Fehler.
    recipientsChildProtectionNote:
      "Minderjährige kannst du nur anschreiben, wenn du sie betreust — als Sorgeberechtigte:r oder als Trainer:in ihres Teams.",
    draftBadge: "Neuer Entwurf",

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
    report: "Melden",
    imageAlt: "Bild in der Nachricht",
    imageFailed: "Bild nicht verfügbar",

    // Melden (Verstoss im Chat melden)
    reportEyebrow: "Verstoss melden",
    reportTitle: "Nachricht melden?",
    reportBody:
      "Deine Meldung geht an den Vereinsvorstand. Wir halten den Nachrichtentext samt Zeitpunkt fest — auch dann, wenn die Nachricht später gelöscht wird.",
    reportReasonLabel: "Grund der Meldung",
    reportReasonPlaceholder: "Was ist an dieser Nachricht ein Verstoss?",
    reportReasonRequired: "Bitte gib einen Grund an.",
    reportSubmit: "Meldung senden",
    reportedToast: "Meldung gesendet – der Vorstand kümmert sich darum.",
    reportError: "Meldung konnte nicht gesendet werden — bitte erneut versuchen.",

    // Löschen (Bestätigung)
    deleteEyebrow: "Nachricht löschen",
    deleteTitle: "Nachricht löschen?",
    deleteBody: "Die Nachricht wird endgültig entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Nachricht löschen",
    cancel: "Abbrechen",
    deletedToast: "Nachricht gelöscht",

    // Broadcast / Ansagen (0083): vereinsweiter Ansage-Kanal, nur Vorstand schreibt.
    announcements: "Ansagen",
    broadcastChannel: "Vereinsweite Ansage",
    newBroadcast: "Neue Ansage",
    broadcastReadOnly: "Nur die Vereinsleitung schreibt hier — Ansagen erreichen alle Mitglieder.",
    threadEmptyBodyBroadcast: "Noch keine Ansage. Schreib die erste vereinsweite Mitteilung.",
    // Moderation: der Vorstand entfernt eine fremde Nachricht.
    moderate: "Entfernen",
    moderationDeleteEyebrow: "Moderation",
    moderationDeleteTitle: "Fremde Nachricht entfernen?",
    moderationDeleteBody:
      "Als Vereinsvorstand entfernst du diese Nachricht für alle. Der Wortlaut bleibt für eine bestehende Meldung erhalten — ändern kannst du ihn nicht.",
    moderationDeleteConfirm: "Nachricht entfernen",
    moderatedToast: "Nachricht entfernt",

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
    listEmptyNoTeamTitle: "You are not in any team",
    listEmptyNoTeamBody:
      "Team channels appear once you belong to a team yourself — you read a team's chat as part of it. You can start a direct message any time.",
    channelsErrorTitle: "Conversations could not be loaded",
    channelsErrorBody: "Your conversations could not be loaded right now — please try again.",

    // New direct message (recipient picker)
    newMessage: "New message",
    newMessageTitle: "New message to …",
    newMessageEyebrow: "Direct message",
    searchLabel: "Search for a person",
    searchPlaceholder: "Search by name …",
    recipientsLoadError: "The list could not be loaded right now — please try again.",
    recipientsEmptyTitle: "Nobody to write to",
    recipientsEmptyBody: "There is currently nobody you can start a message with.",
    recipientsNoHitTitle: "No match",
    recipientsNoHitBody: "Nobody in your list matches “{query}”.",
    recipientsChildProtectionNote:
      "You can only message minors you look after — as their guardian or as a coach of their team.",
    draftBadge: "New draft",

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
    report: "Report",
    imageAlt: "Image in message",
    imageFailed: "Image unavailable",

    // Report (report a chat violation)
    reportEyebrow: "Report violation",
    reportTitle: "Report message?",
    reportBody:
      "Your report goes to the club board. We keep the message text and its timestamp on file — even if the message is deleted later.",
    reportReasonLabel: "Reason for the report",
    reportReasonPlaceholder: "What makes this message a violation?",
    reportReasonRequired: "Please give a reason.",
    reportSubmit: "Send report",
    reportedToast: "Report sent — the board will look into it.",
    reportError: "The report could not be sent — please try again.",

    deleteEyebrow: "Delete message",
    deleteTitle: "Delete message?",
    deleteBody: "The message will be removed permanently. This cannot be undone.",
    deleteConfirm: "Delete message",
    cancel: "Cancel",
    deletedToast: "Message deleted",

    // Broadcast / announcements (0083): club-wide channel, only the board posts.
    announcements: "Announcements",
    broadcastChannel: "Club-wide announcement",
    newBroadcast: "New announcement",
    broadcastReadOnly: "Only the club board posts here — announcements reach every member.",
    threadEmptyBodyBroadcast: "No announcement yet. Post the first club-wide message.",
    // Moderation: the board removes a foreign message.
    moderate: "Remove",
    moderationDeleteEyebrow: "Moderation",
    moderationDeleteTitle: "Remove this message?",
    moderationDeleteBody:
      "As a board member you remove this message for everyone. Its wording is preserved for any existing report — you cannot change it.",
    moderationDeleteConfirm: "Remove message",
    moderatedToast: "Message removed",

    genericError: "Something went wrong — please try again.",
  },
} satisfies Dict;

export type ChatKey = keyof (typeof chatDict)["de"];
