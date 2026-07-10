import { club } from "@/lib/mock";
import type { DunningLogEntry, LedgerCategory } from "@/lib/types";
import { dateFromNow } from "@/lib/mock/util";

/**
 * Mock-Seed der Finanz-A-Module (Kassenbuch-Kategorien + Mahnprotokoll).
 * Spiegelt die DB-Seed-Absicht (5 Kategorien, 2 Mahnprotokoll-Zeilen), damit
 * die Verwaltungs-Screens auch ohne Dev-Stack erfahrbar sind. Kein echter
 * Rechtecheck — die Wahrheit ist im api-Modus der Server (RLS).
 */

const c = club.id;

/** 5 Kategorien: Beitrag/Spende = Einnahme, Halle/Material/Sonstiges = Ausgabe. */
export const ledgerCategorySeed: LedgerCategory[] = [
  { id: "cat-01", clubId: c, name: "Beitrag", kind: "income", sortOrder: 1 },
  { id: "cat-02", clubId: c, name: "Spende", kind: "income", sortOrder: 2 },
  { id: "cat-03", clubId: c, name: "Halle", kind: "expense", sortOrder: 3 },
  { id: "cat-04", clubId: c, name: "Material", kind: "expense", sortOrder: 4 },
  { id: "cat-05", clubId: c, name: "Sonstiges", kind: "expense", sortOrder: 5 },
];

/**
 * Freitext-Kategorie der bestehenden Kassenbuch-Rows → strukturierte Kategorie-ID.
 * Erlaubt es dem Mock-Modul, mock.ledger mit categoryId/-Name/-Kind anzureichern,
 * ohne die Basis-Seed-Datei (lib/mock/finance.ts) anzufassen.
 */
export const legacyCategoryMap: Record<string, string> = {
  Beiträge: "cat-01",
  Miete: "cat-03",
  Material: "cat-04",
  Lizenzen: "cat-05",
  Wettkampf: "cat-05",
  Trainingslager: "cat-05",
};

/** 2 Mahnprotokoll-Zeilen zu den am weitesten eskalierten offenen Rechnungen. */
export const dunningLogSeed: DunningLogEntry[] = [
  {
    id: "dl-01",
    clubId: c,
    invoiceId: "i-05",
    fromStage: 2,
    toStage: 3,
    action: "dunning",
    actorMemberId: "m-01",
    note: "2. Mahnung — Zahlungsfrist erneut überschritten",
    createdAt: `${dateFromNow(-14)}T09:12:00.000Z`,
  },
  {
    id: "dl-02",
    clubId: c,
    invoiceId: "i-01",
    fromStage: 1,
    toStage: 2,
    action: "dunning",
    actorMemberId: "m-01",
    note: "1. Mahnung nach Zahlungserinnerung",
    createdAt: `${dateFromNow(-9)}T08:40:00.000Z`,
  },
];
