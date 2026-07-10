import type { Id } from "./types";

/**
 * View-Typen der Finanz-B-Module (Beitragsstammdaten): Beitragskategorien,
 * Mitglieds-Beitragszuordnungen inkl. Jahres-Summary, Familien-/Geschwister-
 * rabatte und SEPA-Mandate. Ausgelagert aus lib/types.ts (< 400 Zeilen) und
 * dort per `export type * from "./types-financeb"` wieder unter "@/lib/types"
 * verfügbar.
 *
 * Rechte SERVERSEITIG (RLS): Kategorien/Familienrabatte lesen = is_club_member,
 * schreiben = can_manage_finance. Beitragszuordnungen + SEPA-Mandate lesen =
 * can_manage_finance ODER can_act_for_member (eigenes Mitglied + Kinder via
 * guardianships), schreiben = can_manage_finance. Die Summary ist strikt
 * can_manage_finance (ein Mitglied bekommt 403).
 *
 * DATENSCHUTZ (SEPA): NIE die volle IBAN — nur die letzten vier Ziffern
 * (ibanLast4, DB-CHECK ^[0-9]{4}$) + Mandatsreferenz. Beträge sind Integer-Cent
 * (Mono/tabular darstellen, nie Float).
 */

/* ---------- Enums (snake_case auf dem Draht) ---------- */

/** Abrechnungsperiode einer Beitragskategorie. */
export type MembershipPeriod = "monthly" | "quarterly" | "yearly" | "once";

/** Art eines Familienrabatts: Prozentwert (0..100) oder Fest-Cent-Betrag. */
export type FamilyDiscountKind = "percent" | "fixed";

/** Status eines SEPA-Mandats (Widerruf setzt 'revoked'). */
export type SepaMandateStatus = "active" | "revoked";

/* ---------- Beitragskategorien ---------- */

/**
 * Beitragskategorie (Stammdaten-Dropdown). amountCents ist Integer-Cent; die
 * period bestimmt die Annualisierung in der Summary. Löschen ist soft
 * (deletedAt gesetzt) — bestehende Zuordnungen behalten die Kategorie.
 */
export interface MembershipCategory {
  id: Id;
  clubId: Id;
  name: string;
  /** Regel-Beitrag in Cent (Integer, nie Float). */
  amountCents: number;
  period: MembershipPeriod;
  isActive: boolean;
  /** Sortier-Reihenfolge im Dropdown (aufsteigend). */
  sortOrder: number;
  /** Gesetzt = soft-gelöscht. */
  deletedAt?: string;
}

/* ---------- Mitglieds-Beitragszuordnungen ---------- */

/**
 * Beitragszuordnung eines Mitglieds zu einer Kategorie, optional mit
 * abweichendem Betrag (customAmountCents). Der effektive Beitrag ist
 * `customAmountCents ?? categoryAmountCents` (im Mapper als effectiveAmountCents
 * vorberechnet). RLS: can_manage_finance ODER eigenes Mitglied/Kind.
 */
export interface MemberFee {
  id: Id;
  clubId: Id;
  memberId: Id;
  categoryId: Id;
  /** Abweichender Betrag in Cent (überschreibt den Kategorie-Betrag). */
  customAmountCents?: number;
  /** ISO-Datum (YYYY-MM-DD), ab wann die Zuordnung gilt. */
  validFrom: string;
  /** ISO-Datum (YYYY-MM-DD), bis wann die Zuordnung gilt (offen = undefined). */
  validUntil?: string;
  /** Join: Name der Kategorie (aus GET /member-fees). */
  categoryName?: string;
  /** Join: Regel-Beitrag der Kategorie in Cent. */
  categoryAmountCents?: number;
  /** Join: Periode der Kategorie. */
  categoryPeriod?: MembershipPeriod;
  /** Vorberechnet: customAmountCents ?? categoryAmountCents ?? 0. */
  effectiveAmountCents: number;
  /** Gesetzt = soft-gelöscht. */
  deletedAt?: string;
}

/** Eine Periode-Zeile der Beitrags-Summary (GET /member-fees/summary). */
export interface MemberFeesSummaryBucket {
  period: MembershipPeriod;
  /** Anzahl Zuordnungen dieser Periode. */
  count: number;
  /** Summe der effektiven Beträge dieser Periode in Cent. */
  amountCents: number;
  /** Annualisiert (monthly ×12, quarterly ×4, yearly ×1, once ×0) in Cent. */
  annualCents: number;
}

/**
 * Beitrags-Jahres-Summary eines Vereins (STRIKT can_manage_finance — ein
 * Mitglied bekommt 403). once ist nicht wiederkehrend und aus
 * totalAnnualCents ausgeschlossen.
 */
export interface MemberFeesSummary {
  clubId: Id;
  byPeriod: MemberFeesSummaryBucket[];
  /** Summe aller annualisierten Beträge (ohne once) in Cent. */
  totalAnnualCents: number;
}

/* ---------- Familien-/Geschwisterrabatte ---------- */

/**
 * Familien-/Geschwisterrabatt-Regel (reine Stammdaten — die Anwendung auf
 * Rechnungen ist noch NICHT implementiert). Bei kind='percent' ist valueNumeric
 * ein Prozentwert (0..100), bei kind='fixed' ein Fest-Cent-Betrag.
 * appliesFromChild = ab dem wievielten Kind der Rabatt greift (v1: 2).
 */
export interface FamilyDiscount {
  id: Id;
  clubId: Id;
  label: string;
  kind: FamilyDiscountKind;
  /** percent → 0..100 · fixed → Fest-Cent-Betrag. */
  valueNumeric: number;
  /** Ab dem wievielten Kind der Rabatt greift (Default 2). */
  appliesFromChild: number;
  isActive: boolean;
  /** Gesetzt = soft-gelöscht. */
  deletedAt?: string;
}

/* ---------- SEPA-Mandate ---------- */

/**
 * SEPA-Lastschriftmandat. DATENSCHUTZ: KEINE volle IBAN — nur ibanLast4
 * (vier Ziffern) + Mandatsreferenz. Widerruf setzt status='revoked'
 * (updateSepaMandate/revokeSepaMandate). RLS: can_manage_finance ODER
 * eigenes Mitglied/Kind.
 */
export interface SepaMandate {
  id: Id;
  clubId: Id;
  memberId: Id;
  /** Eindeutige Mandatsreferenz (unique je Verein). */
  mandateReference: string;
  /** NUR die letzten vier IBAN-Ziffern (nie die volle IBAN). */
  ibanLast4?: string;
  accountHolder: string;
  /** ISO-Datum (YYYY-MM-DD) der Unterschrift. */
  signedOn?: string;
  status: SepaMandateStatus;
  /** Gesetzt = soft-gelöscht. */
  deletedAt?: string;
}
