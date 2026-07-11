import type { Dict } from "@/lib/i18n";
import type { GuardianRelation } from "@/lib/data";
import type { Guardianship } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary für den Familien-Bereich. Regel: JEDER String
 * in beiden Sprachen, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 */
export const familieDict = {
  de: {
    title: "Familie",
    sub: "Deine verknüpften Familienmitglieder im Verein — mit Team und Beitragsstatus",

    childrenTitle: "Meine Kinder",
    guardiansTitle: "Eltern & Bezugspersonen",
    countLinked: "{n} verknüpft",

    relParent: "Elternteil",
    relGrandparent: "Großeltern",
    relGuardian: "Erziehungsberechtigte:r",
    relOther: "Bezugsperson",
    bornYear: "Jahrgang {year}",

    duesPaid: "Beitrag bezahlt",
    duesExempt: "Beitragsfrei",

    openMember: "Profil öffnen: {name}",

    /* ---------- Aktionen ---------- */
    createChildCta: "Kind anlegen",
    linkChildCta: "Kind verknüpfen",
    removeAction: "Verknüpfung entfernen",
    removeActionFor: "Verknüpfung zu {name} entfernen",

    emptyTitle: "Noch keine Familienmitglieder verknüpft",
    emptyBody:
      "Lege ein Kind ohne eigenen Zugang an oder verknüpfe ein bestehendes, vereinsverwaltetes Mitglied als dein Kind. Team und Beitragsstatus erscheinen danach hier.",

    selfserviceHint:
      "Du verwaltest hier deine eigenen Kinder. Elternteile & Bezugspersonen werden von der Vereinsverwaltung gepflegt.",
    partialHint:
      "Team- und Beitragsdaten sind im api-Modus noch nicht angebunden — diese Angaben können unvollständig sein.",

    /* ---------- Kind anlegen ---------- */
    createEyebrow: "Familie",
    createTitle: "Kind anlegen",
    createLead:
      "Legt ein neues Mitglied ohne eigenen Zugang an und verknüpft es direkt mit dir.",
    fFirstName: "Vorname",
    fFirstNamePlaceholder: "z. B. Lina",
    fFirstNameError: "Bitte einen Vornamen eingeben.",
    fLastName: "Nachname",
    fLastNamePlaceholder: "z. B. Grünewald",
    fLastNameError: "Bitte einen Nachnamen eingeben.",
    fBirthDate: "Geburtsdatum",
    fBirthDateHint: "Optional — hilft bei der Zuordnung zur Altersklasse.",
    fRelation: "Verhältnis",
    createSubmit: "Anlegen",
    createdToast: "{name} angelegt und verknüpft.",

    /* ---------- Kind verknüpfen ---------- */
    linkEyebrow: "Familie",
    linkTitle: "Kind verknüpfen",
    linkLead:
      "Verknüpfe ein bestehendes, vereinsverwaltetes Mitglied ohne eigenen Zugang als dein Kind.",
    linkSearchLabel: "Mitglied suchen",
    linkSearchPlaceholder: "Name eingeben …",
    linkNoCandidates:
      "Keine verknüpfbaren Mitglieder gefunden. Es lassen sich nur vereinsverwaltete Mitglieder ohne eigenen Zugang verknüpfen.",
    linkNoMatch: "Kein Mitglied passt zur Suche.",
    linkPickFirst: "Bitte zuerst ein Mitglied auswählen.",
    linkSubmit: "Verknüpfen",
    linkedToast: "{name} als Kind verknüpft.",

    /* ---------- Verknüpfung entfernen ---------- */
    removeEyebrow: "Verknüpfung entfernen",
    removeTitle: "Verknüpfung zu {name} entfernen?",
    removeBody:
      "Die Familien-Verknüpfung wird entfernt. Das Mitglied selbst bleibt im Verein bestehen — nur die Zuordnung zu dir wird aufgehoben.",
    removeConfirm: "Entfernen",
    removedToast: "Verknüpfung zu {name} entfernt.",

    cancel: "Abbrechen",
    forbidden: "Dafür fehlt dir die Berechtigung.",

    niTitle: "Noch nicht angebunden",
    niBody: "Die Familien-Verknüpfungen haben im api-Modus noch keinen Endpoint.",
    loadErrorTitle: "Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Family",
    sub: "Your linked family members in the club — with team and fee status",

    childrenTitle: "My children",
    guardiansTitle: "Parents & caregivers",
    countLinked: "{n} linked",

    relParent: "Parent",
    relGrandparent: "Grandparent",
    relGuardian: "Legal guardian",
    relOther: "Caregiver",
    bornYear: "Born {year}",

    duesPaid: "Fees paid",
    duesExempt: "Fee-exempt",

    openMember: "Open profile: {name}",

    /* ---------- Actions ---------- */
    createChildCta: "Add child",
    linkChildCta: "Link child",
    removeAction: "Remove link",
    removeActionFor: "Remove link to {name}",

    emptyTitle: "No family members linked yet",
    emptyBody:
      "Add a child without their own login, or link an existing club-managed member as your child. Team and fee status appear here afterwards.",

    selfserviceHint:
      "You manage your own children here. Parents & caregivers are maintained by the club administration.",
    partialHint:
      "Team and fee data are not connected in api mode yet — these details may be incomplete.",

    /* ---------- Add child ---------- */
    createEyebrow: "Family",
    createTitle: "Add child",
    createLead: "Creates a new member without their own login and links them directly to you.",
    fFirstName: "First name",
    fFirstNamePlaceholder: "e.g. Lina",
    fFirstNameError: "Please enter a first name.",
    fLastName: "Last name",
    fLastNamePlaceholder: "e.g. Grünewald",
    fLastNameError: "Please enter a last name.",
    fBirthDate: "Date of birth",
    fBirthDateHint: "Optional — helps with age-group assignment.",
    fRelation: "Relationship",
    createSubmit: "Add",
    createdToast: "{name} added and linked.",

    /* ---------- Link child ---------- */
    linkEyebrow: "Family",
    linkTitle: "Link child",
    linkLead: "Link an existing club-managed member without their own login as your child.",
    linkSearchLabel: "Search member",
    linkSearchPlaceholder: "Type a name …",
    linkNoCandidates:
      "No linkable members found. Only club-managed members without their own login can be linked.",
    linkNoMatch: "No member matches your search.",
    linkPickFirst: "Please select a member first.",
    linkSubmit: "Link",
    linkedToast: "{name} linked as your child.",

    /* ---------- Remove link ---------- */
    removeEyebrow: "Remove link",
    removeTitle: "Remove link to {name}?",
    removeBody:
      "The family link will be removed. The member stays in the club — only their link to you is dissolved.",
    removeConfirm: "Remove",
    removedToast: "Link to {name} removed.",

    cancel: "Cancel",
    forbidden: "You don't have permission to do that.",

    niTitle: "Not connected yet",
    niBody: "Family links have no endpoint in api mode yet.",
    loadErrorTitle: "Data could not be loaded",
    retry: "Try again",
  },
} satisfies Dict;

export type FamilieKey = keyof (typeof familieDict)["de"];

/** Verwandtschaftsgrad (View-Enum) → Dictionary-Key des Beziehungs-Labels. */
export const RELATION_KEY: Record<Guardianship["relation"], FamilieKey> = {
  parent: "relParent",
  grandparent: "relGrandparent",
  other: "relOther",
};

/**
 * Auswahl-Optionen für das Verhältnis beim Anlegen/Verknüpfen (Wire-Enum
 * GuardianRelation) mit Dictionary-Key — Elternteil ist die Vorgabe.
 */
export const GUARDIAN_RELATION_OPTIONS: readonly {
  value: GuardianRelation;
  key: FamilieKey;
}[] = [
  { value: "parent", key: "relParent" },
  { value: "guardian", key: "relGuardian" },
  { value: "other", key: "relOther" },
];
