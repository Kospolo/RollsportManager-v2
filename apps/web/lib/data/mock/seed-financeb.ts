import { club } from "@/lib/mock";
import type {
  FamilyDiscount,
  MemberFee,
  MembershipCategory,
  SepaMandate,
} from "@/lib/types";

/**
 * Mock-Seed der Finanz-B-Module (Beitragskategorien, Beitragszuordnungen,
 * Familienrabatte, SEPA-Mandate). Spiegelt die DB-Seed-Absicht plausibel,
 * damit die Beitrags-Screens auch ohne Dev-Stack erfahrbar sind. Kein echter
 * Rechtecheck — die Wahrheit ist im api-Modus der Server (RLS). Beträge sind
 * Integer-Cent. DATENSCHUTZ (SEPA): nur ibanLast4, nie eine volle IBAN.
 */

const c = club.id;

/** 5 Beitragskategorien über alle Perioden hinweg. */
export const membershipCategorySeed: MembershipCategory[] = [
  { id: "mc-01", clubId: c, name: "Aktiv Erwachsene", amountCents: 9300, period: "monthly", isActive: true, sortOrder: 1 },
  { id: "mc-02", clubId: c, name: "Aktiv Kind/Jugend", amountCents: 6500, period: "monthly", isActive: true, sortOrder: 2 },
  { id: "mc-03", clubId: c, name: "Fördernd/Passiv", amountCents: 6000, period: "yearly", isActive: true, sortOrder: 3 },
  { id: "mc-04", clubId: c, name: "Kürgruppe Leistung", amountCents: 3600, period: "quarterly", isActive: true, sortOrder: 4 },
  { id: "mc-05", clubId: c, name: "Startgebühr Wettkampf", amountCents: 2500, period: "once", isActive: true, sortOrder: 5 },
];

/** Kategorie-Stammdaten für den Join in den Beitragszuordnungen (Mock). */
const catById = new Map(membershipCategorySeed.map((m) => [m.id, m]));

function fee(
  id: string,
  memberId: string,
  categoryId: string,
  validFrom: string,
  customAmountCents?: number,
): MemberFee {
  const cat = catById.get(categoryId);
  const categoryAmountCents = cat?.amountCents;
  return {
    id,
    clubId: c,
    memberId,
    categoryId,
    customAmountCents,
    validFrom,
    categoryName: cat?.name,
    categoryAmountCents,
    categoryPeriod: cat?.period,
    effectiveAmountCents: customAmountCents ?? categoryAmountCents ?? 0,
  };
}

/**
 * Beitragszuordnungen: Erwachsene 9300/Monat, Kinder 6500/Monat, plus
 * Quartals-, Jahres- und Einmal-Zuordnungen — deckt alle Perioden für die
 * Summary ab (once fließt NICHT ins Jahres-Total).
 */
export const memberFeeSeed: MemberFee[] = [
  fee("mf-01", "m-01", "mc-01", "2015-09-01"),
  fee("mf-02", "m-09", "mc-01", "2021-09-01"),
  fee("mf-03", "m-12", "mc-01", "2020-01-15"),
  fee("mf-04", "m-07", "mc-02", "2021-09-01"),
  fee("mf-05", "m-08", "mc-02", "2023-03-01"),
  fee("mf-06", "m-10", "mc-02", "2020-01-15"),
  fee("mf-07", "m-11", "mc-02", "2022-04-01", 5000),
  fee("mf-08", "m-16", "mc-04", "2018-09-01"),
  fee("mf-09", "m-14", "mc-03", "2021-02-01"),
  fee("mf-10", "m-13", "mc-05", "2026-01-01"),
];

/** 2 Familienrabatte: Geschwisterrabatt (Prozent) + Familienobergrenze (fix). */
export const familyDiscountSeed: FamilyDiscount[] = [
  {
    id: "fd-01",
    clubId: c,
    label: "Geschwisterrabatt",
    kind: "percent",
    valueNumeric: 25,
    appliesFromChild: 2,
    isActive: true,
  },
  {
    id: "fd-02",
    clubId: c,
    label: "Familien-Festrabatt ab 3. Kind",
    kind: "fixed",
    valueNumeric: 3000,
    appliesFromChild: 3,
    isActive: true,
  },
];

/**
 * 3 SEPA-Mandate (nur ibanLast4). m-09/m-12 aktiv, m-14 widerrufen — deckt
 * beide Status ab. DATENSCHUTZ: es liegt NIE eine volle IBAN im Mock.
 */
export const sepaMandateSeed: SepaMandate[] = [
  {
    id: "sm-01",
    clubId: c,
    memberId: "m-09",
    mandateReference: "RSV-2026-0001",
    ibanLast4: "1234",
    accountHolder: "Katrin Grünewald",
    signedOn: "2021-09-05",
    status: "active",
  },
  {
    id: "sm-02",
    clubId: c,
    memberId: "m-12",
    mandateReference: "RSV-2026-0002",
    ibanLast4: "5678",
    accountHolder: "Stefanie Müller",
    signedOn: "2020-01-20",
    status: "active",
  },
  {
    id: "sm-03",
    clubId: c,
    memberId: "m-14",
    mandateReference: "RSV-2026-0003",
    ibanLast4: "9012",
    accountHolder: "Petra Köhler",
    signedOn: "2021-02-10",
    status: "revoked",
  },
];
