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
    badgeBookable: "Zusatzmodul",
    hintBookable: "Zubuchbares Modul: für neue Vereine voreingestellt AUS. Erst einschalten, dann steht es dem Verein zur Verfügung.",
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
    hintFinanceRetention:
      "Aus blendet alles Finanzielle aus — es wird NICHTS gelöscht. Das Kassenbuch bleibt aufbewahrt (GoBD-sicher durch die Buchungs-Trigger) und ist beim Wieder-Einschalten sofort zurück.",
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

    // ------------------------------------------------------------------------
    // SICHTBARKEIT (Migration 0077) — die vierte Frage: WEM wird die Kachel
    // angeboten?
    //
    // Der Warnhinweis ist hier kein Kleingedrucktes, sondern der wichtigste
    // String der Datei: wer glaubt, mit dem Ausblenden Daten geschützt zu
    // haben, verlässt sich auf etwas, das es nicht gibt.
    // ------------------------------------------------------------------------
    visTitle: "Wer sieht was",
    visSub: "Hier stellst du ein, welche Kacheln im Menü angeboten werden — je Rolle, Gruppe oder Person.",
    visNotSecurityTitle: "Das ist Aufräumen, kein Zugriffsschutz.",
    visNotSecurityBody:
      "Eine ausgeblendete Kachel nimmt niemandem ein Recht: über einen direkten Link darf dieselbe Person genau so viel wie vorher. Und eine eingeblendete Kachel gibt kein Recht — die Seite dahinter bleibt leer, wenn jemand nicht darf. Wer den ZUGRIFF steuern will, geht zu „Rollen & Rechte“.",
    visModulePicker: "Modul",
    visModuleOff:
      "Dieses Modul ist für den Verein gerade nicht verfügbar (abgeschaltet oder nicht gebucht). Solange das so ist, sieht es niemand — unabhängig von der Einstellung hier.",

    visRoles: "Rollen",
    visRolesSub:
      "Die Grundeinstellung. „Vorgabe“ leitet sich aus den Rechten der Rolle ab und wandert mit, wenn ihr die Rechte ändert.",
    visGroups: "Gruppen",
    visGroupsSub: "Ausnahmen für eine ganze Gruppe. Sie gehen der Rolle vor.",
    visMembers: "Einzelne Mitglieder",
    visMembersSub: "Ausnahmen für eine einzelne Person. Sie gehen allem anderen vor.",
    visNoException: "Keine Ausnahme gesetzt — es gilt die Rollen-Einstellung.",

    visChoiceLabel: "Sichtbarkeit für „{title}“",
    visChoiceDefault: "Vorgabe",
    visChoiceOn: "Zeigen",
    visChoiceOff: "Ausblenden",
    visBadgeDefault: "unverändert",
    visDefaultShown: "Vorgabe: wird gezeigt",
    visDefaultHidden: "Vorgabe: wird nicht gezeigt",

    visAddGroup: "Gruppe hinzufügen",
    visAddMember: "Mitglied hinzufügen",
    visAddPlaceholder: "Auswählen …",

    visSaved: "Einstellung für „{title}“ gespeichert.",
    visSaveFailed: "Konnte die Einstellung für „{title}“ nicht speichern.",
    visLoadFailed: "Die Sichtbarkeits-Einstellung konnte nicht geladen werden.",
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
    badgeBookable: "Add-on module",
    hintBookable: "Add-on module: switched OFF by default for new clubs. Switch it on to make it available to the club.",
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
    hintFinanceRetention:
      "Off hides everything financial — NOTHING is deleted. The cash book stays retained (GoBD-safe via the ledger triggers) and is back the moment you switch it on again.",
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

    // --- Visibility (migration 0077) ----------------------------------------
    visTitle: "Who sees what",
    visSub: "Choose which tiles are offered in the menu — per role, group or person.",
    visNotSecurityTitle: "This is tidying up, not access control.",
    visNotSecurityBody:
      "A hidden tile takes nobody's right away: via a direct link the same person may do exactly as much as before. And a shown tile grants no right — the page behind it stays empty if someone is not allowed. To control ACCESS, go to “Roles & permissions”.",
    visModulePicker: "Module",
    visModuleOff:
      "This module is currently unavailable for the club (switched off or not booked). While that is the case nobody sees it, no matter what is set here.",

    visRoles: "Roles",
    visRolesSub:
      "The base setting. “Default” is derived from the role's permissions and moves with them when you change the permissions.",
    visGroups: "Groups",
    visGroupsSub: "Exceptions for a whole group. They take precedence over the role.",
    visMembers: "Individual members",
    visMembersSub: "Exceptions for a single person. They take precedence over everything else.",
    visNoException: "No exception set — the role setting applies.",

    visChoiceLabel: "Visibility for “{title}”",
    visChoiceDefault: "Default",
    visChoiceOn: "Show",
    visChoiceOff: "Hide",
    visBadgeDefault: "unchanged",
    visDefaultShown: "Default: shown",
    visDefaultHidden: "Default: not shown",

    visAddGroup: "Add group",
    visAddMember: "Add member",
    visAddPlaceholder: "Select …",

    visSaved: "Setting for “{title}” saved.",
    visSaveFailed: "Could not save the setting for “{title}”.",
    visLoadFailed: "The visibility settings could not be loaded.",
  },
} satisfies Dict;

export type ModuleKey = keyof (typeof moduleDict)["de"];
