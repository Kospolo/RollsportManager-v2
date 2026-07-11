import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der System-Ansicht (Betreiber-Ebene). Rein
 * informativ/lesend: App-Version, Auth-Modus, Health, DB-Kennzahlen, angewandte
 * Migrationen und die Feature-Flags (aus den Plattform-Einstellungen). Beide
 * Sprachen, echte Umlaute — Quelle ist GET /platform/system (+ /settings).
 */
export const systemDict = {
  de: {
    title: "System",
    sub: "Technischer Zustand dieser Instanz — App-Version, Datenbank, Migrationen und Health.",
    demoNote: "Demo-Daten — in der echten Instanz stammt alles aus GET /platform/system.",

    // Instanz-Überblick
    instanceEyebrow: "Überblick",
    instanceTitle: "Instanz",
    appVersion: "App-Version",
    authMode: "Auth-Modus",
    authDev: "Entwicklung",
    authProd: "Produktion",
    health: "Health-Status",
    healthOk: "Betriebsbereit",
    dbTime: "DB-Zeit {time}",

    // Datenbank-Kennzahlen
    dbEyebrow: "Datenbank",
    dbTitle: "Kennzahlen",
    kpiClubs: "Vereine",
    kpiUsers: "Nutzer",
    kpiMembers: "Mitgliedschaften",
    kpiActiveEnt: "Aktive Lizenzen",
    kpiWebhooks: "Webhook-Events",
    kpiDbSize: "Datenbank-Größe",
    dbSizeSub: "{bytes} Bytes",

    // Migrationen
    migEyebrow: "Datenbank",
    migTitle: "Angewandte Migrationen",
    migLatest: "Zuletzt angewandt",
    migNone: "Noch keine Migration angewandt.",
    migCount: "{n} gesamt",
    badgeLatest: "aktuell",
    colMigration: "Migration",
    migCaption: "Liste der auf diese Instanz angewandten Datenbank-Migrationen",
    migEmptyTitle: "Keine Migrationen",
    migEmptyBody: "Auf dieser Instanz wurde noch keine Migration angewandt.",

    // Feature-Flags
    flagsEyebrow: "Einstellungen",
    flagsTitle: "Feature-Flags",
    flagsCaption: "Global geschaltete Funktionsschalter dieser Instanz",
    flagOn: "An",
    flagOff: "Aus",
    flagsCount: "{n} Flags",
    colFlag: "Flag",
    colState: "Zustand",
    flagsEmptyTitle: "Keine Feature-Flags",
    flagsEmptyBody: "Für diese Instanz sind keine Feature-Flags hinterlegt.",

    // Zustände
    loadErrorTitle: "System-Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
    noAccessTitle: "Kein Zugriff auf die Betreiber-Ebene",
    noAccessBody:
      "Diese Ansicht ist Plattform-Administrator:innen vorbehalten. Melde dich mit einem Konto an, dessen Token app_metadata.is_platform_admin trägt.",
    backToPortal: "Zum Vereinsportal",
  },
  en: {
    title: "System",
    sub: "Technical state of this instance — app version, database, migrations and health.",
    demoNote: "Demo data — the real instance sources everything from GET /platform/system.",

    instanceEyebrow: "Overview",
    instanceTitle: "Instance",
    appVersion: "App version",
    authMode: "Auth mode",
    authDev: "Development",
    authProd: "Production",
    health: "Health status",
    healthOk: "Operational",
    dbTime: "DB time {time}",

    dbEyebrow: "Database",
    dbTitle: "Key figures",
    kpiClubs: "Clubs",
    kpiUsers: "Users",
    kpiMembers: "Memberships",
    kpiActiveEnt: "Active licences",
    kpiWebhooks: "Webhook events",
    kpiDbSize: "Database size",
    dbSizeSub: "{bytes} bytes",

    migEyebrow: "Database",
    migTitle: "Applied migrations",
    migLatest: "Last applied",
    migNone: "No migration applied yet.",
    migCount: "{n} total",
    badgeLatest: "latest",
    colMigration: "Migration",
    migCaption: "List of database migrations applied to this instance",
    migEmptyTitle: "No migrations",
    migEmptyBody: "No migration has been applied to this instance yet.",

    flagsEyebrow: "Settings",
    flagsTitle: "Feature flags",
    flagsCaption: "Globally toggled feature switches of this instance",
    flagOn: "On",
    flagOff: "Off",
    flagsCount: "{n} flags",
    colFlag: "Flag",
    colState: "State",
    flagsEmptyTitle: "No feature flags",
    flagsEmptyBody: "No feature flags are configured for this instance.",

    loadErrorTitle: "System data could not be loaded",
    retry: "Try again",
    noAccessTitle: "No access to the operator plane",
    noAccessBody:
      "This view is reserved for platform administrators. Sign in with an account whose token carries app_metadata.is_platform_admin.",
    backToPortal: "To club portal",
  },
} satisfies Dict;

export type SystemKey = keyof (typeof systemDict)["de"];
