import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der persönlichen Einstellungen (App-Shell →
 * „Einstellungen" im Benutzermenü). Regel: JEDER String in beiden Sprachen,
 * deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 *
 * Darstellung (Sprache/Theme) schreibt in die eigenen Präferenzen UND spiegelt
 * sofort die App-weiten i18n/theme-Contexts; Benachrichtigungen steuern die
 * Glocke der Topbar (preferences.notifications, serverseitig partiell gemergt).
 */
export const einstellungenDict = {
  de: {
    title: "Einstellungen",
    sub: "Sprache, Erscheinungsbild und Benachrichtigungen — nur für dich",

    // Ladefehler
    loadErrorTitle: "Einstellungen nicht ladbar",
    retry: "Wiederholen",

    // Darstellung
    appearanceEyebrow: "Darstellung",
    appearanceTitle: "Sprache & Erscheinungsbild",
    languageLabel: "Sprache",
    languageDesc: "Sprache der Oberfläche. Gilt sofort auf allen deinen Geräten.",
    langDe: "Deutsch",
    langEn: "English",
    themeLabel: "Erscheinungsbild",
    themeDesc: "Hell, dunkel oder automatisch dem System folgend.",
    themeLight: "Hell",
    themeAuto: "Auto",
    themeDark: "Dunkel",
    syncErrorToast: "Einstellung konnte nicht gespeichert werden.",

    // Benachrichtigungen
    notifyEyebrow: "Benachrichtigungen",
    notifyTitle: "Was dich erreichen soll",
    notifyHint:
      "Steuert die Glocke oben rechts. Deine Auswahl ist privat und gilt nur für dich.",
    notifyEvents: "Termine",
    notifyEventsDesc: "Anstehende Trainings und Wettkämpfe sowie offene Zu-/Absagen.",
    notifyInvoices: "Rechnungen",
    notifyInvoicesDesc: "Fällige und überfällige Beiträge und Rechnungen an dich.",
    notifyNews: "Neuigkeiten",
    notifyNewsDesc: "Neue Beiträge aus dem Vereins-Newsboard.",
    notifyChat: "Chat",
    notifyChatDesc: "Neue Nachrichten in deinen Unterhaltungen.",

    // Admin-Verweis
    adminEyebrow: "Verwaltung",
    adminTitle: "Vereins-Einstellungen",
    adminDesc:
      "Stammdaten, Kontakt und Bankverbindung des Vereins bearbeiten (nur für die Vereinsleitung).",
    adminCta: "Zu den Vereins-Einstellungen",
  },
  en: {
    title: "Settings",
    sub: "Language, appearance and notifications — just for you",

    // Load error
    loadErrorTitle: "Couldn’t load settings",
    retry: "Try again",

    // Appearance
    appearanceEyebrow: "Appearance",
    appearanceTitle: "Language & appearance",
    languageLabel: "Language",
    languageDesc: "Interface language. Applies instantly across all your devices.",
    langDe: "Deutsch",
    langEn: "English",
    themeLabel: "Appearance",
    themeDesc: "Light, dark or automatically following the system.",
    themeLight: "Light",
    themeAuto: "Auto",
    themeDark: "Dark",
    syncErrorToast: "Couldn’t save that setting.",

    // Notifications
    notifyEyebrow: "Notifications",
    notifyTitle: "What should reach you",
    notifyHint:
      "Controls the bell in the top right. Your choice is private and applies only to you.",
    notifyEvents: "Events",
    notifyEventsDesc: "Upcoming training and competitions plus open RSVPs.",
    notifyInvoices: "Invoices",
    notifyInvoicesDesc: "Due and overdue fees and invoices addressed to you.",
    notifyNews: "News",
    notifyNewsDesc: "New posts from the club news board.",
    notifyChat: "Chat",
    notifyChatDesc: "New messages in your conversations.",

    // Admin link
    adminEyebrow: "Management",
    adminTitle: "Club settings",
    adminDesc:
      "Edit the club’s master data, contact and bank details (club leadership only).",
    adminCta: "Go to club settings",
  },
} satisfies Dict;
