import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Modul-Verwaltung (Migration 0044).
 * Regel: JEDER String in beiden Sprachen, deutsche Strings mit echten Umlauten
 * (ä/ö/ü/ß).
 *
 * ### Was hier NICHT steht ###
 * Die Modul-Namen und -Beschreibungen. Die kommen vom Server
 * (app.modules.label_de/label_en/desc_de/desc_en) — genau wie bei den Rollen
 * (rollen/i18n.ts). Ein zweites Verzeichnis hier würde beim ersten neuen Modul
 * schlicht falsch.
 *
 * ### DIE BESCHRIFTUNG IST DER PUNKT DIESER DATEI ###
 * Ein Schalter, der nur die Kachel versteckt, darf NICHT „Aus" heißen, als wäre
 * das Modul zu. Das ist dieselbe Selbsttäuschung, die der Nutzer bei den
 * Rechten schon einmal zu Recht angeprangert hat — und dieselbe Antwort wie in
 * 0033/rollen: die Wirkung steht an der Sache dran (app.modules.enforcement).
 *
 *   enforced  -> „Aus" heißt wirklich aus (RLS: 0 Zeilen, Schreiben scheitert)
 *   partial   -> „wirkt nur teilweise" — ein Server-Pfad umgeht den Schalter
 *   menu_only -> „versteckt nur die Kachel" — die Daten bleiben abrufbar
 *   core      -> gar kein Schalter (und die Begründung dazu)
 */
export const moduleDict = {
  de: {
    title: "Module",
    sub: "Hier stellst du ein, welche Bereiche dein Verein benutzt",
    eyebrow: "Verwaltung",

    sectionSwitchable: "Abschaltbar",
    sectionSwitchableSub: "Was ihr nicht braucht, verschwindet aus dem Menü.",
    sectionCore: "Immer an",
    sectionCoreSub: "Diese Bereiche lassen sich nicht abschalten.",

    switchLabel: "Modul „{title}“",
    on: "An",
    off: "Aus",

    // --- Die ehrlichen Etiketten (0044) -------------------------------------
    badgePro: "PRO",
    badgeCore: "Kernmodul",
    /** enforcement = 'partial' */
    badgePartial: "wirkt nur teilweise",
    /** enforcement = 'menu_only' */
    badgeMenuOnly: "versteckt nur die Kachel",

    hintPartial:
      "Aus blendet den Bereich aus und sperrt den direkten Zugriff — aber nicht jeden Weg: Eltern können weiterhin für ihre Kinder handeln.",
    hintMenuOnly:
      "Aus blendet nur die Kachel aus. Die Daten bleiben über die Schnittstelle abrufbar — dieser Schalter ist noch keine Sperre.",
    hintProMissing:
      "PRO-Funktion ohne aktive Lizenz: bleibt zu, auch wenn der Schalter an ist.",
    hintCoreMembers:
      "Ohne Mitglieder ließe sich der Verein nicht mehr verwalten — auch dieser Schalter hinge daran.",
    hintCoreFinance:
      "Aufbewahrungspflicht (GoBD): Buchungsbelege müssen zehn Jahre lang lesbar bleiben.",
    hintCoreManage: "Hier stehen die Schalter selbst — abgeschaltet gäbe es keinen Weg zurück.",

    // --- Rückmeldung --------------------------------------------------------
    savedOn: "„{title}“ ist jetzt an.",
    savedOff: "„{title}“ ist jetzt aus.",
    saveFailed: "Konnte „{title}“ nicht umstellen.",
    retry: "Wiederholen",

    // --- Zustände -----------------------------------------------------------
    loadFailed: "Module konnten nicht geladen werden.",
    loadFailedBody: "Die Liste der Module ist gerade nicht erreichbar.",
    notAllowedTitle: "Kein Zugriff",
    notAllowedBody:
      "Module dürfen nur Inhaber:in, Administrator:in und Moderator:in umstellen.",
    readOnlyNote: "Du kannst die Schalterstellung sehen, aber nicht ändern.",
  },
  en: {
    title: "Modules",
    sub: "Choose which areas your club uses",
    eyebrow: "Administration",

    sectionSwitchable: "Can be switched off",
    sectionSwitchableSub: "Whatever you do not need disappears from the menu.",
    sectionCore: "Always on",
    sectionCoreSub: "These areas cannot be switched off.",

    switchLabel: "Module “{title}”",
    on: "On",
    off: "Off",

    badgePro: "PRO",
    badgeCore: "Core module",
    badgePartial: "only partly effective",
    badgeMenuOnly: "hides the tile only",

    hintPartial:
      "Off hides the area and blocks direct access — but not every path: parents can still act for their children.",
    hintMenuOnly:
      "Off only hides the tile. The data stays available through the API — this switch is not a lock yet.",
    hintProMissing: "PRO feature without an active licence: stays closed even when switched on.",
    hintCoreMembers:
      "Without members the club could no longer be administered — including this very switch.",
    hintCoreFinance:
      "Retention duty (GoBD): accounting records must stay readable for ten years.",
    hintCoreManage: "The switches themselves live here — switched off there would be no way back.",

    savedOn: "“{title}” is now on.",
    savedOff: "“{title}” is now off.",
    saveFailed: "Could not switch “{title}”.",
    retry: "Retry",

    loadFailed: "Modules could not be loaded.",
    loadFailedBody: "The list of modules is currently unreachable.",
    notAllowedTitle: "No access",
    notAllowedBody: "Only owner, admin and moderator may switch modules.",
    readOnlyNote: "You can see the switch positions but not change them.",
  },
} satisfies Dict;

export type ModuleKey = keyof (typeof moduleDict)["de"];
