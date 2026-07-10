import type * as M from "@/lib/api/generated";
import type {
  FamilyDiscount,
  MemberFee,
  MemberFeesSummary,
  MembershipCategory,
  SepaMandate,
} from "@/lib/types";

/**
 * Mapper der Finanz-B-Module (Beitragskategorien, Beitragszuordnungen inkl.
 * Summary, Familienrabatte, SEPA-Mandate): API-Wire-Format (snake_case,
 * `T | null`) → View-Typen (lib/types, camelCase, optionale Felder).
 * Ausgelagert aus api/mappers.ts (< 400 Zeilen). Beträge bleiben Integer-Cent.
 */

export function mapMembershipCategory(w: M.MembershipCategory): MembershipCategory {
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    amountCents: w.amount_cents ?? 0,
    period: w.period,
    isActive: w.is_active,
    sortOrder: w.sort_order ?? 0,
    deletedAt: w.deleted_at ?? undefined,
  };
}

export function mapMemberFee(w: M.MemberFee): MemberFee {
  const customAmountCents = w.custom_amount_cents ?? undefined;
  const categoryAmountCents = w.category_amount_cents ?? undefined;
  return {
    id: w.id,
    clubId: w.club_id,
    memberId: w.member_id,
    categoryId: w.category_id,
    customAmountCents,
    validFrom: w.valid_from,
    validUntil: w.valid_until ?? undefined,
    categoryName: w.category_name ?? undefined,
    categoryAmountCents,
    categoryPeriod: w.category_period,
    // Effektiver Beitrag: custom überschreibt den Kategorie-Betrag.
    effectiveAmountCents: customAmountCents ?? categoryAmountCents ?? 0,
    deletedAt: w.deleted_at ?? undefined,
  };
}

export function mapMemberFeesSummary(w: M.MemberFeeSummary): MemberFeesSummary {
  return {
    clubId: w.club_id,
    byPeriod: w.by_period.map((b) => ({
      period: b.period,
      count: b.count ?? 0,
      amountCents: b.amount_cents ?? 0,
      annualCents: b.annual_cents ?? 0,
    })),
    totalAnnualCents: w.total_annual_cents ?? 0,
  };
}

export function mapFamilyDiscount(w: M.FamilyDiscount): FamilyDiscount {
  return {
    id: w.id,
    clubId: w.club_id,
    label: w.label,
    kind: w.kind,
    valueNumeric: w.value_numeric ?? 0,
    appliesFromChild: w.applies_from_child ?? 2,
    isActive: w.is_active,
    deletedAt: w.deleted_at ?? undefined,
  };
}

export function mapSepaMandate(w: M.SepaMandate): SepaMandate {
  return {
    id: w.id,
    clubId: w.club_id,
    memberId: w.member_id,
    mandateReference: w.mandate_reference,
    // DATENSCHUTZ: nur die letzten vier Ziffern kommen je vom Server.
    ibanLast4: w.iban_last4 ?? undefined,
    accountHolder: w.account_holder,
    signedOn: w.signed_on ?? undefined,
    status: w.status,
    deletedAt: w.deleted_at ?? undefined,
  };
}
