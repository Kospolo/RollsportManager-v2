import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Steuerzentrale „Rollen & Rechte".
 * Regel: JEDER String in beiden Sprachen, deutsche Strings mit echten Umlauten
 * (ä/ö/ü/ß).
 *
 * ### Was hier NICHT mehr steht ###
 * Die Rollen-Namen. Die kommen jetzt vom Server (app.roles.name_de/name_en) und
 * sind pro Verein änderbar. Der alte Eintrag nannte owner „Vorstand", die
 * Datenbank nennt ihn „Inhaber:in" (0023:111) — und nach der ersten Umbenennung
 * im Verein wäre jedes Dictionary hier schlicht falsch.
 *
 * ### Die Beschriftung der Stufen ###
 * „Kein Zugriff" gibt es NUR, wo der Server das Lesen wirklich sperrt
 * (enforcement = 'enforced'). Überall sonst heißt „none" hier „Kein Bearbeiten"
 * — siehe derive.ts:noneLabelKey und Migration 0033. Das ist keine Vorsicht,
 * sondern Genauigkeit: gemessen bleiben bei finance=none Bankkonto, Budgets,
 * Beiträge und SEPA-Mandate lesbar.
 */
export const rollenDict = {
  de: {
    title: "Rollen & Rechte",
    sub: "Hier stellst du ein, wer im Verein was darf",

    /* Tabs */
    tabMatrix: "Rechte",
    tabRoles: "Rollen",
    tabPeople: "Personen",
    tabCoaches: "Trainer:innen",

    /* Sofortwirksamkeit — das ist ein Feature, also sagen wir es */
    liveEyebrow: "Sofort wirksam",
    liveTitle: "Änderungen gelten augenblicklich",
    liveBody:
      "Rechte werden bei jeder Anfrage frisch aus der Datenbank aufgelöst — nicht aus dem Anmelde-Token. Wer gerade angemeldet ist, sieht deine Änderung beim nächsten Laden. Niemand muss sich neu anmelden.",

    /* Server-Hinweis */
    serverEyebrow: "Durchgesetzt wird serverseitig",
    serverTitle: "Diese Oberfläche ist nicht der Schutz",
    serverBody:
      "Was hier ausgeblendet wird, ist Bequemlichkeit. Die Rechte selbst setzt der Server durch (Datenbank-Policies und API-Prüfungen) — auch gegenüber Clients, die diese Oberfläche gar nicht benutzen.",

    /* ---------- Matrix ---------- */
    matrixEyebrow: "Rechte-Matrix",
    matrixTitle: "Was jede Rolle darf",
    matrixSub:
      "Wähle je Fähigkeit und Rolle eine Stufe. Angeboten wird nur, was für die Fähigkeit vorgesehen ist.",
    matrixCaption: "Rechte-Matrix: Fähigkeiten und die Stufe je Rolle",
    colCapability: "Fähigkeit",
    saveAll: "Änderungen speichern",
    discard: "Verwerfen",
    dirtyCount: "{n} Änderung(en) noch nicht gespeichert",
    savingLabel: "Wird gespeichert …",
    matrixSaved: "Stufen gespeichert — sie gelten ab sofort.",
    selectAria: "Stufe von „{cap}“ für die Rolle „{role}“",

    /* Stufen */
    levelNoneOff: "Kein Zugriff",
    levelNoneNoEdit: "Kein Bearbeiten",
    levelReadOwn: "Nur Eigenes lesen",
    levelReadTeam: "Eigenes Team lesen",
    levelReadAll: "Alles lesen",
    levelEdit: "Bearbeiten",
    levelManage: "Verwalten",

    /* Etiketten: was die Stufe WIRKLICH bewirkt (0033) */
    enfEnforced: "wirkt vollständig",
    enfPartial: "wirkt nur teilweise",
    enfWriteOnly: "wirkt beim Bearbeiten",
    enfUnenforced: "wirkt noch nicht",
    enfEnforcedHint:
      "„Kein Zugriff“ nimmt hier wirklich den Lesezugriff weg — die Einstellung tut, was sie sagt.",
    enfPartialHint:
      "Achtung: Diese Einstellung sperrt das Lesen nur zum Teil. Bei den Finanzen wirkt sie auf Rechnungen und Kassenbuch, aber Bankkonto, Budgets, Beiträge, SEPA-Mandate, Spenden und Mahnungen bleiben sichtbar. Bei den Kontaktdaten wirkt sie nur auf den Jubiläums-Bericht — in der Mitgliederliste stehen E-Mail und Geburtsdatum weiterhin.",
    enfWriteOnlyHint:
      "Diese Einstellung entscheidet nur über das Bearbeiten. Gelesen wird in diesem Bereich weiterhin von allen Mitgliedern.",
    enfUnenforcedHint:
      "Diese Einstellung wird noch nirgends ausgewertet — der Bereich hängt weiterhin an der Rolle selbst. Du kannst sie setzen, sie ändert im Moment aber nichts.",
    enfLegendTitle: "Was die Stufen bewirken",
    enfLegendBody:
      "Nicht jede Fähigkeit wird gleich streng durchgesetzt. Das Etikett hinter dem Namen sagt, worauf die Einstellung tatsächlich wirkt — lieber ein ehrliches Etikett als ein schöner Schalter, der nichts tut.",

    /* Geschützte Fähigkeiten (owner_only) */
    ownerOnlyBadge: "Nur Inhaber:in",
    ownerOnlyLocked:
      "Diese Fähigkeit ist geschützt: nur die Vereinsinhaberin oder der Vereinsinhaber darf sie ändern. Sonst könnte sich jede Person, die Rollen verwaltet, den Zugriff selbst zurückgeben.",
    protectedRoleNote:
      "Die Inhaber-Rolle ist geschützt — ihre Rechte lassen sich nicht ändern, damit sich der Verein nicht selbst aussperrt.",

    /* ---------- Rollen ---------- */
    rolesEyebrow: "Rollen",
    rolesTitle: "Rollen des Vereins",
    rolesSub:
      "Die Systemrollen sind die Vorlage. Du kannst sie umbenennen und beliebige eigene Rollen anlegen.",
    roleNew: "Rolle anlegen",
    roleNewTitle: "Neue Rolle",
    roleEditTitle: "Rolle bearbeiten",
    roleNameDe: "Name (Deutsch)",
    roleNameEn: "Name (Englisch)",
    roleKey: "Schlüssel",
    roleKeyHint:
      "Technische Kennung, später unveränderlich. Kleinbuchstaben, Ziffern und Unterstrich; beginnt mit einem Buchstaben.",
    roleKeyInvalid:
      "Der Schlüssel muss mit einem Kleinbuchstaben beginnen und darf nur Kleinbuchstaben, Ziffern und Unterstriche enthalten (2 bis 41 Zeichen).",
    roleNameRequired: "Bitte in beiden Sprachen einen Namen angeben.",
    roleCreate: "Anlegen",
    roleSave: "Speichern",
    roleEdit: "Bearbeiten",
    roleCancel: "Abbrechen",
    roleDelete: "Löschen",
    roleDeleteTitle: "Rolle löschen?",
    roleDeleteBody: "„{name}“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.",
    roleDeleteConfirm: "Endgültig löschen",
    roleSystemBadge: "Systemrolle",
    roleOwnBadge: "Eigene Rolle",
    roleProtectedBadge: "Geschützt",
    roleNoPermissions: "Ohne Rechte",
    roleMemberCount: "{n} Person(en)",
    roleNewHint:
      "Eine neue Rolle startet ohne jedes Recht. Vergib die Stufen anschließend im Reiter „Rechte“.",
    roleCreated: "Rolle „{name}“ angelegt.",
    roleUpdated: "Rolle „{name}“ gespeichert.",
    roleDeleted: "Rolle „{name}“ gelöscht.",

    /* ---------- Personen ---------- */
    peopleEyebrow: "Zuweisung",
    peopleTitle: "Wer hat welche Rollen",
    peopleSub:
      "Eine Person kann mehrere Rollen haben. Ihre Rechte sind die Vereinigung: bei jeder Fähigkeit gilt die höchste Stufe.",
    colMember: "Person",
    colRoles: "Rollen",
    colEdit: "Ändern",
    editRoles: "Rollen ändern",
    editRolesTitle: "Rollen von {name}",
    editRolesSub: "Mehrfachauswahl. Die Rechte sind die Vereinigung aller angehakten Rollen.",
    noRoles: "Keine Rolle",
    youTag: "Du",
    rolesSaved: "Rollen von {name} gespeichert.",
    tableCaption: "Mitglieder und ihre Rollen",
    emptyTitle: "Keine Mitglieder",
    emptyBody: "Sobald Mitglieder im Verein sind, kannst du ihnen hier Rollen geben.",

    /* ---------- Trainer:innen ---------- */
    coachesEyebrow: "Trainer:innen",
    coachesTitle: "Wer betreut welche Teams",
    coachesSub:
      "Eine Trainerin oder ein Trainer kann mehrere Teams betreuen. Wer ein Team betreut, sieht dessen Küren.",
    colCoach: "Person",
    colTeams: "Teams",
    editTeams: "Teams ändern",
    editTeamsTitle: "Teams von {name}",
    editTeamsSub:
      "Mehrfachauswahl. Wer in einem Team bereits Skater:in ist, kann dort nicht zusätzlich Trainer:in sein.",
    noTeams: "Kein Team",
    isSkaterHere: "Ist hier Skater:in",
    teamsSaved: "Teams von {name} gespeichert.",
    coachesEmptyTitle: "Keine Teams",
    coachesEmptyBody: "Lege zuerst ein Team an, dann kannst du Trainer:innen zuordnen.",
    coachesTableCaption: "Personen und die Teams, die sie betreuen",
    coachSelfNote:
      "Eine Trainerin kann sich nicht selbst einem Team zuordnen — das darf nur, wer Teams verwaltet.",

    /* ---------- Zustände ---------- */
    lockedTitle: "Nur Ansicht",
    lockedBody:
      "Du darfst Rollen und Rechte in diesem Verein nicht ändern. Angezeigt wird dir der aktuelle Stand.",
    forbiddenTitle: "Kein Zugriff",
    forbiddenBody:
      "Für diesen Bereich fehlt dir die Berechtigung. Wende dich an die Vereinsverwaltung.",
    loadErrorTitle: "Konnte nicht geladen werden",
    retry: "Erneut versuchen",
    toastForbidden: "Dazu fehlt dir die Berechtigung. Der Server hat die Änderung abgelehnt.",
    demoTag: "Demo",
    demoNote:
      "Demo-Modus: Änderungen bleiben nur bis zum Neuladen erhalten. Mit echter Datenquelle schreibt diese Seite auf den Server.",
  },
  en: {
    title: "Roles & permissions",
    sub: "Set who may do what in the club",

    tabMatrix: "Permissions",
    tabRoles: "Roles",
    tabPeople: "People",
    tabCoaches: "Coaches",

    liveEyebrow: "Takes effect immediately",
    liveTitle: "Changes apply right away",
    liveBody:
      "Permissions are resolved fresh from the database on every request — not from the sign-in token. Anyone currently signed in sees your change on their next load. Nobody has to sign in again.",

    serverEyebrow: "Enforced on the server",
    serverTitle: "This screen is not the protection",
    serverBody:
      "What is hidden here is convenience. The permissions themselves are enforced by the server (database policies and API checks) — including against clients that never use this screen.",

    matrixEyebrow: "Permission matrix",
    matrixTitle: "What each role may do",
    matrixSub:
      "Pick a level per capability and role. Only the levels intended for that capability are offered.",
    matrixCaption: "Permission matrix: capabilities and the level per role",
    colCapability: "Capability",
    saveAll: "Save changes",
    discard: "Discard",
    dirtyCount: "{n} unsaved change(s)",
    savingLabel: "Saving …",
    matrixSaved: "Levels saved — they apply from now on.",
    selectAria: "Level of “{cap}” for the role “{role}”",

    levelNoneOff: "No access",
    levelNoneNoEdit: "No editing",
    levelReadOwn: "Read own only",
    levelReadTeam: "Read own team",
    levelReadAll: "Read all",
    levelEdit: "Edit",
    levelManage: "Manage",

    enfEnforced: "fully effective",
    enfPartial: "only partly effective",
    enfWriteOnly: "affects editing",
    enfUnenforced: "not yet effective",
    enfEnforcedHint:
      "“No access” really does remove read access here — the setting does what it says.",
    enfPartialHint:
      "Careful: this setting only partly blocks reading. For finance it affects invoices and the ledger, but bank account, budgets, fees, SEPA mandates, donations and dunning remain visible. For contact details it only affects the anniversaries report — the member list still shows e-mail and date of birth.",
    enfWriteOnlyHint:
      "This setting only decides about editing. Reading in this area remains open to all members.",
    enfUnenforcedHint:
      "This setting is not evaluated anywhere yet — the area still depends on the role itself. You may set it, but right now it changes nothing.",
    enfLegendTitle: "What the levels actually do",
    enfLegendBody:
      "Not every capability is enforced equally strictly. The label after the name tells you what the setting really affects — an honest label beats a pretty switch that does nothing.",

    ownerOnlyBadge: "Owner only",
    ownerOnlyLocked:
      "This capability is protected: only the club owner may change it. Otherwise anyone who manages roles could simply grant themselves access again.",
    protectedRoleNote:
      "The owner role is protected — its permissions cannot be changed, so the club cannot lock itself out.",

    rolesEyebrow: "Roles",
    rolesTitle: "Roles of this club",
    rolesSub:
      "The system roles are the template. You can rename them and add any number of your own roles.",
    roleNew: "Add role",
    roleNewTitle: "New role",
    roleEditTitle: "Edit role",
    roleNameDe: "Name (German)",
    roleNameEn: "Name (English)",
    roleKey: "Key",
    roleKeyHint:
      "Technical identifier, immutable afterwards. Lowercase letters, digits and underscore; starts with a letter.",
    roleKeyInvalid:
      "The key must start with a lowercase letter and may only contain lowercase letters, digits and underscores (2 to 41 characters).",
    roleNameRequired: "Please provide a name in both languages.",
    roleCreate: "Create",
    roleSave: "Save",
    roleEdit: "Edit",
    roleCancel: "Cancel",
    roleDelete: "Delete",
    roleDeleteTitle: "Delete role?",
    roleDeleteBody: "“{name}” will be deleted permanently. This cannot be undone.",
    roleDeleteConfirm: "Delete permanently",
    roleSystemBadge: "System role",
    roleOwnBadge: "Custom role",
    roleProtectedBadge: "Protected",
    roleNoPermissions: "No permissions",
    roleMemberCount: "{n} person(s)",
    roleNewHint:
      "A new role starts with no permissions at all. Assign the levels afterwards in the “Permissions” tab.",
    roleCreated: "Role “{name}” created.",
    roleUpdated: "Role “{name}” saved.",
    roleDeleted: "Role “{name}” deleted.",

    peopleEyebrow: "Assignment",
    peopleTitle: "Who holds which roles",
    peopleSub:
      "A person can hold several roles. Their permissions are the union: the highest level wins per capability.",
    colMember: "Person",
    colRoles: "Roles",
    colEdit: "Change",
    editRoles: "Change roles",
    editRolesTitle: "Roles of {name}",
    editRolesSub: "Multiple choice. Permissions are the union of all ticked roles.",
    noRoles: "No role",
    youTag: "You",
    rolesSaved: "Roles of {name} saved.",
    tableCaption: "Members and their roles",
    emptyTitle: "No members",
    emptyBody: "Once the club has members, you can give them roles here.",

    coachesEyebrow: "Coaches",
    coachesTitle: "Who coaches which teams",
    coachesSub:
      "A coach can look after several teams. Whoever coaches a team sees that team’s routines.",
    colCoach: "Person",
    colTeams: "Teams",
    editTeams: "Change teams",
    editTeamsTitle: "Teams of {name}",
    editTeamsSub:
      "Multiple choice. Someone who is already a skater in a team cannot also be a coach there.",
    noTeams: "No team",
    isSkaterHere: "Is a skater here",
    teamsSaved: "Teams of {name} saved.",
    coachesEmptyTitle: "No teams",
    coachesEmptyBody: "Create a team first, then you can assign coaches.",
    coachesTableCaption: "People and the teams they coach",
    coachSelfNote:
      "A coach cannot assign themselves to a team — only someone who manages teams may do that.",

    lockedTitle: "View only",
    lockedBody:
      "You may not change roles and permissions in this club. You are seeing the current state.",
    forbiddenTitle: "No access",
    forbiddenBody: "You lack the permission for this area. Please contact the club administration.",
    loadErrorTitle: "Could not be loaded",
    retry: "Try again",
    toastForbidden: "You lack the permission for this. The server rejected the change.",
    demoTag: "Demo",
    demoNote:
      "Demo mode: changes only last until you reload. With a real data source this screen writes to the server.",
  },
} satisfies Dict;

export type RollenKey = keyof (typeof rollenDict)["de"];
