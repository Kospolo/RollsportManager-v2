import type { Dict } from "@/lib/i18n";
import type { Guardianship } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary für den Familien-Bereich. Regel: JEDER String
 * in beiden Sprachen, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 */
export const familieDict = {
  de: {
    title: "Familie",
    sub: "Deine verknüpften Familienmitglieder im Verein — mit Team und Beitragsstatus",
    linkCta: "Familienmitglied verknüpfen",
    soonToast: "Bald verfügbar — hier verknüpfst du Familienmitglieder in einer kommenden Version.",
    soonHint: "Bald kannst du Kinder und Bezugspersonen direkt hier verknüpfen. Aktuell übernimmt das die Vereinsverwaltung.",

    childrenTitle: "Meine Kinder",
    guardiansTitle: "Eltern & Bezugspersonen",
    countLinked: "{n} verknüpft",

    relParent: "Elternteil",
    relGrandparent: "Großeltern",
    relOther: "Bezugsperson",
    bornYear: "Jahrgang {year}",

    duesPaid: "Beitrag bezahlt",
    duesExempt: "Beitragsfrei",

    openMember: "Profil öffnen: {name}",

    emptyTitle: "Noch keine Familienmitglieder verknüpft",
    emptyBody:
      "Sobald Eltern und Kinder im Verein miteinander verknüpft sind, erscheinen sie hier — mit Team und Beitragsstatus. Die Verknüpfung übernimmt derzeit die Vereinsverwaltung.",

    partialHint: "Team- und Beitragsdaten sind im api-Modus noch nicht angebunden — diese Angaben können unvollständig sein.",

    niTitle: "Noch nicht angebunden",
    niBody: "Die Familien-Verknüpfungen haben im api-Modus noch keinen Endpoint.",
    loadErrorTitle: "Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Family",
    sub: "Your linked family members in the club — with team and fee status",
    linkCta: "Link family member",
    soonToast: "Coming soon — you'll link family members here in a future version.",
    soonHint: "Soon you'll be able to link children and caregivers right here. For now the club administration handles it.",

    childrenTitle: "My children",
    guardiansTitle: "Parents & caregivers",
    countLinked: "{n} linked",

    relParent: "Parent",
    relGrandparent: "Grandparent",
    relOther: "Caregiver",
    bornYear: "Born {year}",

    duesPaid: "Fees paid",
    duesExempt: "Fee-exempt",

    openMember: "Open profile: {name}",

    emptyTitle: "No family members linked yet",
    emptyBody:
      "Once parents and children are linked in the club, they appear here — with team and fee status. Linking is currently handled by the club administration.",

    partialHint: "Team and fee data are not connected in api mode yet — these details may be incomplete.",

    niTitle: "Not connected yet",
    niBody: "Family links have no endpoint in api mode yet.",
    loadErrorTitle: "Data could not be loaded",
    retry: "Try again",
  },
} satisfies Dict;

export type FamilieKey = keyof (typeof familieDict)["de"];

/** Verwandtschaftsgrad → Dictionary-Key des Beziehungs-Labels. */
export const RELATION_KEY: Record<Guardianship["relation"], FamilieKey> = {
  parent: "relParent",
  grandparent: "relGrandparent",
  other: "relOther",
};
