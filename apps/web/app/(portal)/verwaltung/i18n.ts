import type { Dict } from "@/lib/i18n";

/**
 * Strings des Verwaltungs-Hubs — kolokalisiert, immer DE + EN mit echten
 * Umlauten. Der Hub ist die Einstiegsseite der Vereins-Administration
 * (Kachel-Raster im „Mehr"-Stil der Original-App, Referenz 3.1).
 */
export const verwaltungDict = {
  de: {
    eyebrow: "Vereins-Administration",
    title: "Verwaltung",
    sub: "Verein, Menschen und Teams an einem Ort — sichtbar ist nur, was deine Rolle darf.",

    tileMembersTitle: "Mitglieder-Verwaltung",
    tileMembersDesc: "Stammdaten pflegen, Status setzen, Personen einladen.",
    tileRolesTitle: "Rollen & Rechte",
    tileRolesDesc: "Rollen vergeben — innerhalb deiner Hierarchie.",
    tileModulesTitle: "Module",
    tileModulesDesc: "Einstellen, welche Bereiche dein Verein benutzt.",
    tileTeamsTitle: "Teams",
    tileTeamsDesc: "Mannschaften anlegen, umbenennen und Kader zusammenstellen.",
    tileSettingsTitle: "Vereins-Einstellungen",
    tileSettingsDesc: "Vereinsdaten, Disziplin und aktivierbare Module.",
    tilePlatformTitle: "Plattform",
    tilePlatformDesc: "Vereins- und Nutzerübersicht der gesamten Plattform.",
    platformBadge: "Super-Admin",

    openTile: "{title} öffnen",

    noAccessTitle: "Keine Verwaltungsrechte",
    noAccessBody:
      "Für die Vereins-Verwaltung brauchst du eine Admin-Rolle. Sprich deinen Vereins-Owner an.",
    noAccessCta: "Zum Dashboard",

    loadErrorTitle: "Verwaltung nicht ladbar",
    retry: "Wiederholen",
  },
  en: {
    eyebrow: "Club administration",
    title: "Management",
    sub: "Club, people and teams in one place — you only see what your role allows.",

    tileMembersTitle: "Member management",
    tileMembersDesc: "Maintain records, set status, invite people.",
    tileRolesTitle: "Roles & permissions",
    tileRolesDesc: "Assign roles — within your hierarchy.",
    tileModulesTitle: "Modules",
    tileModulesDesc: "Choose which areas your club uses.",
    tileTeamsTitle: "Teams",
    tileTeamsDesc: "Create and rename squads and build their rosters.",
    tileSettingsTitle: "Club settings",
    tileSettingsDesc: "Club details, discipline and toggleable modules.",
    tilePlatformTitle: "Platform",
    tilePlatformDesc: "Club and user overview across the whole platform.",
    platformBadge: "Super admin",

    openTile: "Open {title}",

    noAccessTitle: "No management access",
    noAccessBody:
      "Club management needs an admin role. Please reach out to your club owner.",
    noAccessCta: "Go to dashboard",

    loadErrorTitle: "Could not load management",
    retry: "Retry",
  },
} satisfies Dict;

export type VerwaltungKey = keyof (typeof verwaltungDict)["de"];
