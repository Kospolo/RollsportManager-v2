import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des SEPA-Mandate-Screens (/finanzen/sepa,
 * Seriositätszone). DE und EN werden IMMER gemeinsam gepflegt — deutsche
 * Strings mit echten ä/ö/ü/ß. Ein Dict für den ganzen Bereich (Client +
 * Erfassungs-Sheet + Widerruf-Dialog), analog kassenbuchDict.
 *
 * DATENSCHUTZ-Ton: Es wird NIE die vollständige IBAN gespeichert oder
 * übertragen — nur die letzten vier Ziffern (ibanLast4) + Mandatsreferenz.
 * Sichtbar/verwaltbar nur für can_manage_finance (RLS bleibt maßgeblich).
 */
export const sepaDict = {
  de: {
    // Seitenkopf
    pageEyebrow: "SEPA-Lastschrift",
    pageTitle: "SEPA-Mandate",
    pageSub: "{active} aktiv · {revoked} widerrufen",
    back: "Zurück zu Finanzen",
    addMandate: "Mandat erfassen",
    collectorButton: "Lastschrift-Sammler",
    collectorSoon: "Der SEPA-Lastschrift-Sammler folgt bald.",

    // Laden / Fehler / Rechte
    retry: "Erneut versuchen",
    loadErrorTitle: "SEPA-Mandate konnten nicht geladen werden",
    noAccessTitle: "Kein Zugriff auf die SEPA-Mandate",
    noAccessBody:
      "SEPA-Mandate verwalten nur Kassenwart:in und Vorstand. Wende dich an die Vereinsleitung, wenn du Einsicht brauchst.",

    // Datenschutz-Hinweis
    privacyEyebrow: "Datenschutz",
    privacyTitle: "Wir speichern nie die vollständige IBAN",
    privacyBody:
      "Zu jedem Mandat werden nur die letzten vier IBAN-Ziffern und die Mandatsreferenz gespeichert. So bleibt die Lastschrift zuordenbar, ohne sensible Bankdaten im Klartext zu halten.",

    // Status-Filter
    filterStatus: "Status",
    statusAll: "Alle",
    statusActive: "Aktiv",
    statusRevoked: "Widerrufen",

    // Tabelle
    tableCaption: "SEPA-Lastschriftmandate des Vereins",
    colMember: "Mitglied",
    colReference: "Mandatsreferenz",
    colIban: "IBAN",
    colHolder: "Kontoinhaber",
    colSigned: "Unterschrieben am",
    colStatus: "Status",
    colAction: "Aktion",
    unknownMember: "Unbekanntes Mitglied",
    ibanMask: "IBAN endet auf {last4}",
    valueUnknown: "—",
    badgeActive: "Aktiv",
    badgeRevoked: "Widerrufen",
    revokeAction: "Widerrufen",

    // Summenzeile
    footCount: "{n} Mandate",
    footCollector: "SEPA-Lastschrift-Sammler & CAMT/XML-Export folgen.",

    // Leere Zustände
    emptyTitle: "Noch keine SEPA-Mandate",
    emptyBody:
      "Erfasse das erste Lastschriftmandat, um Beiträge künftig automatisch einzuziehen. Gespeichert werden nur die letzten vier IBAN-Ziffern.",
    emptyCta: "Erstes Mandat erfassen",
    emptyFilterTitle: "Keine Mandate mit diesem Status",
    emptyFilterBody: "Für den gewählten Status gibt es gerade keine Mandate.",
    emptyFilterCta: "Alle anzeigen",

    // Erfassungs-Sheet
    sheetEyebrow: "Neues Mandat",
    sheetTitle: "SEPA-Mandat erfassen",
    fMember: "Mitglied",
    fMemberPlaceholder: "Mitglied wählen …",
    fReference: "Mandatsreferenz",
    fReferencePlaceholder: "z. B. RSV-2026-0004",
    fReferenceHint: "Eindeutig je Verein — erscheint auf jeder Lastschrift.",
    fIban: "Letzte 4 Ziffern der IBAN",
    fIbanPlaceholder: "1234",
    fIbanHint:
      "Aus Datenschutzgründen erfassen wir nur die letzten vier Ziffern — nie die vollständige IBAN.",
    fHolder: "Kontoinhaber",
    fHolderPlaceholder: "z. B. Katrin Grünewald",
    fSignedOn: "Unterschrieben am",
    errMember: "Bitte ein Mitglied wählen.",
    errReference: "Bitte eine Mandatsreferenz eingeben.",
    errIban: "Bitte genau vier Ziffern eingeben.",
    errHolder: "Bitte den Kontoinhaber eingeben.",
    errSignedOn: "Bitte ein gültiges Datum wählen (nicht in der Zukunft).",
    sheetPrivacy:
      "Es wird nie die vollständige IBAN übertragen oder gespeichert — nur die vier Ziffern oben.",
    cancel: "Abbrechen",
    create: "Mandat speichern",
    createdToast: "SEPA-Mandat {reference} für {name} angelegt.",
    referenceConflict:
      "Diese Mandatsreferenz gibt es bereits — bitte eine andere wählen.",
    forbidden: "Dafür fehlt dir die Berechtigung.",

    // Widerruf-Dialog
    revokeEyebrow: "Widerruf",
    revokeTitle: "Mandat widerrufen",
    revokeIntro:
      "Ein widerrufenes Mandat wird nicht gelöscht — es bleibt zur Nachverfolgung erhalten, aber es dürfen keine weiteren Lastschriften darüber eingezogen werden. Für einen erneuten Einzug ist ein neues Mandat nötig.",
    revokeMandateLabel: "Mandat",
    revokeConfirm: "Mandat widerrufen",
    revokedToast: "Mandat {reference} widerrufen — keine weiteren Lastschriften.",
    alreadyRevoked: "Dieses Mandat ist bereits widerrufen.",
  },
  en: {
    // Page head
    pageEyebrow: "SEPA direct debit",
    pageTitle: "SEPA mandates",
    pageSub: "{active} active · {revoked} revoked",
    back: "Back to finances",
    addMandate: "Add mandate",
    collectorButton: "Direct debit batch",
    collectorSoon: "The SEPA direct debit batch is coming soon.",

    // Loading / errors / permissions
    retry: "Try again",
    loadErrorTitle: "SEPA mandates could not be loaded",
    noAccessTitle: "No access to the SEPA mandates",
    noAccessBody:
      "Only the treasurer and the board can manage SEPA mandates. Talk to the club leadership if you need access.",

    // Data protection notice
    privacyEyebrow: "Data protection",
    privacyTitle: "We never store the full IBAN",
    privacyBody:
      "For each mandate we only store the last four IBAN digits and the mandate reference. That keeps the direct debit identifiable without holding sensitive bank data in plain text.",

    // Status filter
    filterStatus: "Status",
    statusAll: "All",
    statusActive: "Active",
    statusRevoked: "Revoked",

    // Table
    tableCaption: "SEPA direct debit mandates of the club",
    colMember: "Member",
    colReference: "Mandate reference",
    colIban: "IBAN",
    colHolder: "Account holder",
    colSigned: "Signed on",
    colStatus: "Status",
    colAction: "Action",
    unknownMember: "Unknown member",
    ibanMask: "IBAN ending in {last4}",
    valueUnknown: "—",
    badgeActive: "Active",
    badgeRevoked: "Revoked",
    revokeAction: "Revoke",

    // Sum row
    footCount: "{n} mandates",
    footCollector: "SEPA direct debit batch & CAMT/XML export coming soon.",

    // Empty states
    emptyTitle: "No SEPA mandates yet",
    emptyBody:
      "Add the first direct debit mandate to collect fees automatically from now on. Only the last four IBAN digits are stored.",
    emptyCta: "Add first mandate",
    emptyFilterTitle: "No mandates with this status",
    emptyFilterBody: "There are no mandates for the selected status right now.",
    emptyFilterCta: "Show all",

    // Capture sheet
    sheetEyebrow: "New mandate",
    sheetTitle: "Add SEPA mandate",
    fMember: "Member",
    fMemberPlaceholder: "Choose member …",
    fReference: "Mandate reference",
    fReferencePlaceholder: "e.g. RSV-2026-0004",
    fReferenceHint: "Unique per club — shown on every direct debit.",
    fIban: "Last 4 digits of the IBAN",
    fIbanPlaceholder: "1234",
    fIbanHint:
      "For data protection we only capture the last four digits — never the full IBAN.",
    fHolder: "Account holder",
    fHolderPlaceholder: "e.g. Katrin Grünewald",
    fSignedOn: "Signed on",
    errMember: "Please choose a member.",
    errReference: "Please enter a mandate reference.",
    errIban: "Please enter exactly four digits.",
    errHolder: "Please enter the account holder.",
    errSignedOn: "Please choose a valid date (not in the future).",
    sheetPrivacy:
      "The full IBAN is never transmitted or stored — only the four digits above.",
    cancel: "Cancel",
    create: "Save mandate",
    createdToast: "SEPA mandate {reference} created for {name}.",
    referenceConflict:
      "This mandate reference already exists — please choose another.",
    forbidden: "You do not have permission for this.",

    // Revocation dialog
    revokeEyebrow: "Revocation",
    revokeTitle: "Revoke mandate",
    revokeIntro:
      "A revoked mandate is not deleted — it stays on file for traceability, but no further direct debits may be collected under it. A new mandate is required to collect again.",
    revokeMandateLabel: "Mandate",
    revokeConfirm: "Revoke mandate",
    revokedToast: "Mandate {reference} revoked — no further direct debits.",
    alreadyRevoked: "This mandate has already been revoked.",
  },
} satisfies Dict;
