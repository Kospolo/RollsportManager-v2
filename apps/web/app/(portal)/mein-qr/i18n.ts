import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Seite „Mein QR-Code" (/mein-qr): die
 * Großansicht des eigenen Check-in-Codes zum Vorzeigen an der Station. IMMER
 * beide Sprachen vollständig, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 */
export const meinQrDict = {
  de: {
    pageEyebrow: "Check-in",
    pageTitle: "Mein QR-Code",
    pageSub: "Zeig diesen Code beim Training — der Trainerstab scannt ihn zum Einchecken.",
    codeLabel: "Check-in-Code von {name}",
    idLabel: "Mitglieds-ID",
    hint: "Kein Foto, keine Kamera nötig — halte den Code einfach vor die Scan-Station.",
    backToCheckin: "Zum Check-in",

    /* Ohne Vereinsmitgliedschaft (Plattform-Persona) */
    noMemberTitle: "Kein Vereins-Check-in",
    noMemberBody:
      "Dieses Konto ist keinem Verein zugeordnet — es gibt daher keinen persönlichen Check-in-Code.",

    /* Laden / Fehler (Facade) */
    loadErrorTitle: "QR-Code konnte nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    retry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
  },
  en: {
    pageEyebrow: "Check-in",
    pageTitle: "My QR code",
    pageSub: "Show this code at training — the coaching staff scans it to check you in.",
    codeLabel: "Check-in code for {name}",
    idLabel: "Member ID",
    hint: "No photo, no camera needed — just hold the code up to the scan station.",
    backToCheckin: "To check-in",

    /* Without club membership (platform persona) */
    noMemberTitle: "No club check-in",
    noMemberBody:
      "This account is not tied to a club — so there is no personal check-in code.",

    /* Loading / error (facade) */
    loadErrorTitle: "QR code could not be loaded",
    loadErrorBody: "Please try again later.",
    retry: "Try again",
    niTitle: "Not connected yet",
    niBody: "This area has no endpoint in api mode yet.",
  },
} satisfies Dict;

export type MeinQrKey = keyof (typeof meinQrDict)["de"];
