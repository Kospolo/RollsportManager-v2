import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Plattform-Einstellungen ((super)/plattform-
 * einstellungen): E-Mail/SMTP, Rechtstexte, Website & SEO und Feature-Flags.
 * Beide Sprachen, echte Umlaute. Die verbindliche Durchsetzung bleibt
 * serverseitig (requirePlatformAdmin bzw. RLS auf internal.platform_settings);
 * das SMTP-Passwort wird nie im Klartext geliefert (nur passwordSet).
 */
export const einstellungenDict = {
  de: {
    // Kopf
    eyebrow: "Betreiber",
    title: "Einstellungen",
    sub: "SMTP, Rechtstexte, Website-Inhalte und Feature-Flags dieser Instanz verwalten",
    demoNote: "Demo-Daten — Änderungen wirken nur lokal.",
    tabsLabel: "Einstellungsbereiche",
    tabSmtp: "E-Mail",
    tabLegal: "Rechtstexte",
    tabContent: "Website & SEO",
    tabFlags: "Feature-Flags",
    tabBilling: "Abrechnung",
    lastUpdated: "Zuletzt geändert: {date}",

    // Abrechnung / Testphase
    billingEyebrow: "Abrechnung",
    billingTitle: "Testphase",
    billingDesc:
      "Wie viele Tage ein neu registrierter Verein die Pro-Funktionen kostenlos testen kann. Gilt für neue Selbst-Registrierungen; einzelne Vereine lassen sich unter Lizenzen abweichend einstellen.",
    trialDaysLabel: "Testphase (Tage)",
    trialDaysHint: "1–365 Tage. Standard: 14.",
    trialDaysError: "Bitte 1 bis 365 Tage angeben.",

    // Aktionen / Rückmeldungen
    save: "Speichern",
    saving: "Speichern …",
    savedToast: "Einstellungen gespeichert.",

    // E-Mail / SMTP
    smtpEyebrow: "Postausgang",
    smtpTitle: "E-Mail-Versand (SMTP)",
    smtpDesc: "Zugangsdaten des Postausgangsservers. Das Passwort kann nur gesetzt, nie angezeigt werden.",
    fieldHost: "Server (Host)",
    fieldPort: "Port",
    fieldUser: "Benutzername",
    fieldFrom: "Absender",
    fieldSecure: "SSL/TLS",
    secureOn: "An",
    secureOff: "Aus",
    secureDesc: "Verschlüsselte Verbindung (empfohlen, meist Port 465).",
    fieldPassword: "Passwort",
    passwordPlaceholder: "Unverändert lassen",
    passwordHint: "Nur ausfüllen, um das gespeicherte Passwort zu ersetzen.",
    passwordSet: "Passwort hinterlegt",
    passwordUnset: "Kein Passwort hinterlegt",
    portError: "Bitte einen Port zwischen 1 und 65535 angeben.",

    // Rechtstexte
    legalEyebrow: "Pflichtangaben",
    legalTitle: "Rechtstexte",
    legalDesc:
      "Impressum, Datenschutzerklärung und AGB der Plattform — zweisprachig. Formatierung: ## Überschrift, ### Unterüberschrift, - Aufzählung. Wird auf /impressum, /datenschutz und /agb angezeigt.",
    fieldImpressum: "Impressum",
    fieldDatenschutz: "Datenschutzerklärung",
    fieldAgb: "AGB",
    legalLangDe: "Deutsch",
    legalLangEn: "Englisch",
    legalEmptyHint: "Leer lassen = der eingebaute Standardtext wird angezeigt.",
    legalLoadDefault: "Standardtext einfügen",
    legalIsDefault: "Zeigt aktuell den eingebauten Standardtext.",
    legalIsOverride: "Überschreibt den Standardtext.",

    // Website & SEO
    contentEyebrow: "Auftritt",
    contentTitle: "Website & SEO",
    contentDesc: "Titel, Untertitel und Suchmaschinen-Metadaten der öffentlichen Website.",
    fieldWebsiteTitle: "Website-Titel",
    fieldWebsiteSubtitle: "Untertitel",
    fieldSeoTitle: "SEO-Titel",
    fieldSeoDescription: "SEO-Beschreibung",
    fieldSeoKeywords: "SEO-Schlüsselwörter",
    seoKeywordsHint: "Kommagetrennt, z. B. Rollsport, Vereinsverwaltung, Rollkunstlauf.",

    // Feature-Flags
    flagsEyebrow: "Funktionen",
    flagsTitle: "Feature-Flags",
    flagsDesc: "Funktionen plattformweit ein- oder ausschalten. Änderungen wirken sofort.",
    flagsEmpty: "Aktuell sind keine Feature-Flags definiert.",
    flagsHint: "Flags werden serverseitig definiert; hier steuerst du nur ihren Zustand.",
    flag_wettkampf_live: "Live-Wettkampf",
    flag_bankabgleich: "Bankabgleich",
    flag_ki_etikett: "KI-Etikettenerfassung",
    flagOnToast: "„{flag}“ aktiviert.",
    flagOffToast: "„{flag}“ deaktiviert.",

    // Zustände
    loadErrorTitle: "Einstellungen konnten nicht geladen werden",
    retry: "Erneut versuchen",
    noAccessTitle: "Kein Zugriff auf die Betreiber-Ebene",
    noAccessBody:
      "Diese Ansicht ist Plattform-Administrator:innen vorbehalten. Melde dich mit einem Konto an, dessen Token app_metadata.is_platform_admin trägt.",
    backToPortal: "Zum Vereinsportal",
  },
  en: {
    eyebrow: "Operator",
    title: "Settings",
    sub: "Manage SMTP, legal texts, website content and feature flags of this instance",
    demoNote: "Demo data — changes are local only.",
    tabsLabel: "Settings sections",
    tabSmtp: "Email",
    tabLegal: "Legal",
    tabContent: "Website & SEO",
    tabFlags: "Feature flags",
    tabBilling: "Billing",
    billingEyebrow: "Billing",
    billingTitle: "Trial period",
    billingDesc:
      "How many days a newly registered club can try the Pro features for free. Applies to new self-registrations; individual clubs can be overridden under “Licenses”.",
    trialDaysLabel: "Trial period (days)",
    trialDaysHint: "1–365 days. Default: 14.",
    trialDaysError: "Please enter 1 to 365 days.",
    lastUpdated: "Last changed: {date}",

    save: "Save",
    saving: "Saving …",
    savedToast: "Settings saved.",

    smtpEyebrow: "Outgoing mail",
    smtpTitle: "Email delivery (SMTP)",
    smtpDesc: "Credentials of the outgoing mail server. The password can only be set, never displayed.",
    fieldHost: "Server (host)",
    fieldPort: "Port",
    fieldUser: "Username",
    fieldFrom: "Sender",
    fieldSecure: "SSL/TLS",
    secureOn: "On",
    secureOff: "Off",
    secureDesc: "Encrypted connection (recommended, usually port 465).",
    fieldPassword: "Password",
    passwordPlaceholder: "Leave unchanged",
    passwordHint: "Fill in only to replace the stored password.",
    passwordSet: "Password stored",
    passwordUnset: "No password stored",
    portError: "Please enter a port between 1 and 65535.",

    legalEyebrow: "Legal notices",
    legalTitle: "Legal texts",
    legalDesc:
      "Imprint, privacy policy and terms of the platform — bilingual. Formatting: ## heading, ### sub-heading, - bullet. Shown on /impressum, /datenschutz and /agb.",
    fieldImpressum: "Imprint",
    fieldDatenschutz: "Privacy policy",
    fieldAgb: "Terms & conditions",
    legalLangDe: "German",
    legalLangEn: "English",
    legalEmptyHint: "Leave empty = the built-in default text is shown.",
    legalLoadDefault: "Insert default text",
    legalIsDefault: "Currently showing the built-in default text.",
    legalIsOverride: "Overrides the default text.",

    contentEyebrow: "Presence",
    contentTitle: "Website & SEO",
    contentDesc: "Title, subtitle and search-engine metadata of the public website.",
    fieldWebsiteTitle: "Website title",
    fieldWebsiteSubtitle: "Subtitle",
    fieldSeoTitle: "SEO title",
    fieldSeoDescription: "SEO description",
    fieldSeoKeywords: "SEO keywords",
    seoKeywordsHint: "Comma-separated, e.g. roller sports, club management.",

    flagsEyebrow: "Features",
    flagsTitle: "Feature flags",
    flagsDesc: "Turn features on or off across the platform. Changes take effect immediately.",
    flagsEmpty: "No feature flags are currently defined.",
    flagsHint: "Flags are defined server-side; here you only control their state.",
    flag_wettkampf_live: "Live competition",
    flag_bankabgleich: "Bank reconciliation",
    flag_ki_etikett: "AI label scanning",
    flagOnToast: "“{flag}” enabled.",
    flagOffToast: "“{flag}” disabled.",

    loadErrorTitle: "Settings could not be loaded",
    retry: "Try again",
    noAccessTitle: "No access to the operator plane",
    noAccessBody:
      "This view is reserved for platform administrators. Sign in with an account whose token carries app_metadata.is_platform_admin.",
    backToPortal: "To club portal",
  },
} satisfies Dict;

export type EinstellungenKey = keyof (typeof einstellungenDict)["de"];
