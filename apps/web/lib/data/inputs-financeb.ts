import type {
  FamilyDiscount,
  FamilyDiscountKind,
  Id,
  MemberFee,
  MemberFeesSummary,
  MembershipCategory,
  MembershipPeriod,
  SepaMandate,
  SepaMandateStatus,
} from "@/lib/types";

/**
 * Eingabe-Typen + Repository-Slice der Finanz-B-Module (Beitragsstammdaten):
 * Beitragskategorien, Mitglieds-Beitragszuordnungen inkl. Jahres-Summary,
 * Familien-/Geschwisterrabatte und SEPA-Mandate. Ausgelagert aus
 * lib/data/types.ts (< 400 Zeilen). Re-exportiert über lib/data/index.ts;
 * DataRepository erbt FinanceBRepository.
 *
 * Rechte sind SERVERSEITIG (RLS): Kategorien/Familienrabatte lesen =
 * is_club_member, schreiben = can_manage_finance. Beitragszuordnungen +
 * SEPA-Mandate lesen = can_manage_finance ODER can_act_for_member (eigenes
 * Mitglied + Kinder), schreiben = can_manage_finance. Die Summary ist strikt
 * can_manage_finance (Mitglied → 403). Beträge sind Integer-Cent (Mono/tabular).
 *
 * DATENSCHUTZ (SEPA): NIE die volle IBAN — nur ibanLast4 (vier Ziffern) an die
 * API senden; der Zod-Regex und der DB-CHECK lehnen alles andere ab.
 */

/* ---------- Beitragskategorien (can_manage_finance) ---------- */

/** Neue Beitragskategorie. amountCents ist Integer-Cent (Regel-Beitrag). */
export interface CreateMembershipCategoryInput {
  clubId: Id;
  name: string;
  /** Regel-Beitrag in Cent (Integer, nie Float). */
  amountCents: number;
  period: MembershipPeriod;
  isActive?: boolean;
  sortOrder?: number;
}

/** Patch einer Beitragskategorie (nur gesetzte Felder ändern). */
export interface UpdateMembershipCategoryInput {
  name?: string;
  amountCents?: number;
  period?: MembershipPeriod;
  isActive?: boolean;
  sortOrder?: number;
}

/* ---------- Mitglieds-Beitragszuordnungen ---------- */

/** Filter für listMemberFees (RLS gilt zusätzlich). */
export interface ListMemberFeesFilter {
  memberId?: Id;
}

/**
 * Beitrag einem Mitglied zuordnen (can_manage_finance). customAmountCents
 * überschreibt den Kategorie-Betrag; ohne validUntil gilt die Zuordnung offen.
 */
export interface AssignMemberFeeInput {
  clubId: Id;
  memberId: Id;
  categoryId: Id;
  /** Abweichender Betrag in Cent (überschreibt den Kategorie-Betrag). */
  customAmountCents?: number;
  /** ISO-Datum (YYYY-MM-DD). */
  validFrom: string;
  /** ISO-Datum (YYYY-MM-DD); offen = weglassen. */
  validUntil?: string;
}

/**
 * Patch einer Beitragszuordnung. null bei customAmountCents/validUntil leert
 * das Feld (zurück auf Kategorie-Betrag bzw. offenes Ende).
 */
export interface UpdateMemberFeeInput {
  categoryId?: Id;
  customAmountCents?: number | null;
  validFrom?: string;
  validUntil?: string | null;
}

/* ---------- Familien-/Geschwisterrabatte (can_manage_finance) ---------- */

/**
 * Neuer Familienrabatt. valueNumeric: bei kind='percent' Prozentwert 0..100,
 * bei kind='fixed' Fest-Cent-Betrag. appliesFromChild default 2.
 */
export interface CreateFamilyDiscountInput {
  clubId: Id;
  label: string;
  kind: FamilyDiscountKind;
  /** percent → 0..100 · fixed → Fest-Cent-Betrag. */
  valueNumeric: number;
  /** Ab dem wievielten Kind der Rabatt greift (Default 2). */
  appliesFromChild?: number;
  isActive?: boolean;
}

/** Patch eines Familienrabatts (nur gesetzte Felder ändern). */
export interface UpdateFamilyDiscountInput {
  label?: string;
  kind?: FamilyDiscountKind;
  valueNumeric?: number;
  appliesFromChild?: number;
  isActive?: boolean;
}

/* ---------- SEPA-Mandate ---------- */

/** Filter für listSepaMandates (RLS gilt zusätzlich). */
export interface ListSepaMandatesFilter {
  memberId?: Id;
}

/**
 * Neues SEPA-Mandat (can_manage_finance). DATENSCHUTZ: NUR ibanLast4 (vier
 * Ziffern) — eine volle IBAN wird serverseitig abgelehnt. mandateReference ist
 * je Verein eindeutig.
 */
export interface CreateSepaMandateInput {
  clubId: Id;
  memberId: Id;
  mandateReference: string;
  /** NUR die letzten vier IBAN-Ziffern (nie die volle IBAN). */
  ibanLast4?: string;
  accountHolder: string;
  /** ISO-Datum (YYYY-MM-DD) der Unterschrift. */
  signedOn?: string;
  status?: SepaMandateStatus;
}

/**
 * Patch eines SEPA-Mandats (auch Widerruf via status='revoked'). DATENSCHUTZ:
 * NUR ibanLast4. null bei ibanLast4/signedOn leert das Feld.
 */
export interface UpdateSepaMandateInput {
  mandateReference?: string;
  /** NUR die letzten vier IBAN-Ziffern (nie die volle IBAN). */
  ibanLast4?: string | null;
  accountHolder?: string;
  signedOn?: string | null;
  status?: SepaMandateStatus;
}

/* ---------- Repository-Slice der Finanz-B-Module ---------- */

/**
 * Facade-Methoden der Finanz-B-Module. Ausgelagert aus lib/data/types.ts
 * (< 400 Zeilen); DataRepository erbt davon. Rechte SERVERSEITIG — die UI
 * gatet nur zur Anzeige (permissions.canManageFinance).
 */
export interface FinanceBRepository {
  /* ---------- Beitragskategorien (Lesen=Mitglied, Schreiben=Finanz) ---------- */
  /** Beitragskategorien des Vereins (aktive zuerst, nach sortOrder). */
  listMembershipCategories(clubId: Id): Promise<MembershipCategory[]>;
  /** Kategorie anlegen — liefert die erzeugte Kategorie zurück. */
  createMembershipCategory(input: CreateMembershipCategoryInput): Promise<MembershipCategory>;
  /** Kategorie ändern (can_manage_finance). */
  updateMembershipCategory(
    categoryId: Id,
    patch: UpdateMembershipCategoryInput,
  ): Promise<MembershipCategory>;
  /** Kategorie soft-löschen (can_manage_finance) — liefert die gelöschte ID zurück. */
  deleteMembershipCategory(categoryId: Id): Promise<{ id: Id }>;

  /* ---------- Beitragszuordnungen (Finanz ODER eigenes Mitglied/Kind) ---------- */
  /**
   * Beitragszuordnungen des Vereins inkl. Kategorie-Join. RLS liefert einem
   * einfachen Mitglied ausschließlich die EIGENEN + Kinder-Zuordnungen; der
   * memberId-Filter ändert das für Nicht-Finanz nicht.
   */
  listMemberFees(clubId: Id, memberId?: Id): Promise<MemberFee[]>;
  /** Beitrag einem Mitglied zuordnen (can_manage_finance). */
  assignMemberFee(input: AssignMemberFeeInput): Promise<MemberFee>;
  /** Beitragszuordnung ändern (can_manage_finance). */
  updateMemberFee(feeId: Id, patch: UpdateMemberFeeInput): Promise<MemberFee>;
  /** Beitragszuordnung soft-löschen (can_manage_finance) — liefert die gelöschte ID zurück. */
  removeMemberFee(feeId: Id): Promise<{ id: Id }>;
  /** Jahres-Summary der Beiträge (STRIKT can_manage_finance — Mitglied → 403). */
  memberFeesSummary(clubId: Id): Promise<MemberFeesSummary>;

  /* ---------- Familienrabatte (Lesen=Mitglied, Schreiben=Finanz) ---------- */
  /** Familien-/Geschwisterrabatte des Vereins. */
  listFamilyDiscounts(clubId: Id): Promise<FamilyDiscount[]>;
  /** Familienrabatt anlegen — liefert den erzeugten Rabatt zurück. */
  createFamilyDiscount(input: CreateFamilyDiscountInput): Promise<FamilyDiscount>;
  /** Familienrabatt ändern (can_manage_finance). */
  updateFamilyDiscount(
    discountId: Id,
    patch: UpdateFamilyDiscountInput,
  ): Promise<FamilyDiscount>;
  /** Familienrabatt soft-löschen (can_manage_finance) — liefert die gelöschte ID zurück. */
  deleteFamilyDiscount(discountId: Id): Promise<{ id: Id }>;

  /* ---------- SEPA-Mandate (Finanz ODER eigenes Mitglied/Kind) ---------- */
  /**
   * SEPA-Mandate des Vereins (nur ibanLast4, nie volle IBAN). RLS liefert einem
   * Mitglied nur die EIGENEN / Kinder-Mandate; der memberId-Filter ändert das
   * für Nicht-Finanz nicht.
   */
  listSepaMandates(clubId: Id, memberId?: Id): Promise<SepaMandate[]>;
  /** SEPA-Mandat anlegen (can_manage_finance) — NUR ibanLast4 senden. */
  createSepaMandate(input: CreateSepaMandateInput): Promise<SepaMandate>;
  /** SEPA-Mandat ändern (can_manage_finance) — auch Widerruf via status='revoked'. */
  updateSepaMandate(mandateId: Id, patch: UpdateSepaMandateInput): Promise<SepaMandate>;
  /** SEPA-Mandat widerrufen (Kurzform für updateSepaMandate mit status='revoked'). */
  revokeSepaMandate(mandateId: Id): Promise<SepaMandate>;
  /** SEPA-Mandat soft-löschen (can_manage_finance) — liefert die gelöschte ID zurück. */
  removeSepaMandate(mandateId: Id): Promise<{ id: Id }>;
}
