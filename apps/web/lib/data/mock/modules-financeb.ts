import { ApiError } from "@/lib/api/generated";
import type {
  FamilyDiscount,
  MemberFee,
  MemberFeesSummaryBucket,
  MembershipCategory,
  MembershipPeriod,
  SepaMandate,
} from "@/lib/types";
import type { DataRepository } from "../types";
import {
  familyDiscountSeed,
  memberFeeSeed,
  membershipCategorySeed,
  sepaMandateSeed,
} from "./seed-financeb";

/**
 * Mock-Implementierung der Finanz-B-Module (Beitragskategorien, Beitrags-
 * zuordnungen inkl. Summary, Familienrabatte, SEPA-Mandate). Eigene In-Memory-
 * Stores (Session-Lebensdauer), kein echter Rechtecheck — die Wahrheit ist im
 * api-Modus der Server (RLS). Soft-Delete wird plausibel abgebildet (deletedAt
 * gesetzt + aus den Listen gefiltert). Beträge sind Integer-Cent. DATENSCHUTZ
 * (SEPA): nur ibanLast4, nie eine volle IBAN.
 */

const categoryStore: MembershipCategory[] = membershipCategorySeed.map((x) => ({ ...x }));
const feeStore: MemberFee[] = memberFeeSeed.map((x) => ({ ...x }));
const discountStore: FamilyDiscount[] = familyDiscountSeed.map((x) => ({ ...x }));
const mandateStore: SepaMandate[] = sepaMandateSeed.map((x) => ({ ...x }));

let categorySeq = categoryStore.length;
let feeSeq = feeStore.length;
let discountSeq = discountStore.length;
let mandateSeq = mandateStore.length;

/** Annualisierungs-Faktor je Periode (once = 0, aus dem Jahres-Total raus). */
const ANNUAL_FACTOR: Record<MembershipPeriod, number> = {
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  once: 0,
};

/** effectiveAmountCents aus custom ?? Kategorie neu ableiten (nach Patch). */
function recomputeFee(fee: MemberFee): void {
  fee.effectiveAmountCents = fee.customAmountCents ?? fee.categoryAmountCents ?? 0;
}

/** Kategorie-Join eines Fees aus dem categoryStore neu setzen. */
function applyCategoryJoin(fee: MemberFee): void {
  const cat = categoryStore.find((x) => x.id === fee.categoryId);
  fee.categoryName = cat?.name;
  fee.categoryAmountCents = cat?.amountCents;
  fee.categoryPeriod = cat?.period;
  recomputeFee(fee);
}

/** Die 18 Finanz-B-Modul-Methoden — wird in mockRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "listMembershipCategories"
  | "createMembershipCategory"
  | "updateMembershipCategory"
  | "deleteMembershipCategory"
  | "listMemberFees"
  | "assignMemberFee"
  | "updateMemberFee"
  | "removeMemberFee"
  | "memberFeesSummary"
  | "listFamilyDiscounts"
  | "createFamilyDiscount"
  | "updateFamilyDiscount"
  | "deleteFamilyDiscount"
  | "listSepaMandates"
  | "createSepaMandate"
  | "updateSepaMandate"
  | "revokeSepaMandate"
  | "removeSepaMandate"
>;

export const moduleRepositoryFinanceB: ModuleMethods = {
  /* ---------- Beitragskategorien ---------- */
  async listMembershipCategories(clubId) {
    return categoryStore
      .filter((cat) => cat.clubId === clubId && !cat.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async createMembershipCategory(input) {
    const cat: MembershipCategory = {
      id: `mc-local-${++categorySeq}`,
      clubId: input.clubId,
      name: input.name,
      amountCents: input.amountCents,
      period: input.period,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? categoryStore.length + 1,
    };
    categoryStore.push(cat);
    return cat;
  },
  async updateMembershipCategory(categoryId, patch) {
    const cat = categoryStore.find((x) => x.id === categoryId);
    if (!cat) throw new ApiError(404, null, "membership_category_not_found");
    if (patch.name !== undefined) cat.name = patch.name;
    if (patch.amountCents !== undefined) cat.amountCents = patch.amountCents;
    if (patch.period !== undefined) cat.period = patch.period;
    if (patch.isActive !== undefined) cat.isActive = patch.isActive;
    if (patch.sortOrder !== undefined) cat.sortOrder = patch.sortOrder;
    // Join in bestehenden Zuordnungen nachziehen (Betrag/Name/Periode).
    for (const f of feeStore) if (f.categoryId === categoryId) applyCategoryJoin(f);
    return cat;
  },
  async deleteMembershipCategory(categoryId) {
    const cat = categoryStore.find((x) => x.id === categoryId);
    if (cat) cat.deletedAt = new Date().toISOString();
    return { id: categoryId };
  },

  /* ---------- Beitragszuordnungen ---------- */
  async listMemberFees(clubId, memberId) {
    return feeStore.filter(
      (f) => f.clubId === clubId && !f.deletedAt && (!memberId || f.memberId === memberId),
    );
  },
  async assignMemberFee(input) {
    const fee: MemberFee = {
      id: `mf-local-${++feeSeq}`,
      clubId: input.clubId,
      memberId: input.memberId,
      categoryId: input.categoryId,
      customAmountCents: input.customAmountCents,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      effectiveAmountCents: 0,
    };
    applyCategoryJoin(fee);
    feeStore.push(fee);
    return fee;
  },
  async updateMemberFee(feeId, patch) {
    const fee = feeStore.find((x) => x.id === feeId);
    if (!fee) throw new ApiError(404, null, "member_fee_not_found");
    if (patch.categoryId !== undefined) fee.categoryId = patch.categoryId;
    if (patch.customAmountCents !== undefined) {
      fee.customAmountCents = patch.customAmountCents ?? undefined;
    }
    if (patch.validFrom !== undefined) fee.validFrom = patch.validFrom;
    if (patch.validUntil !== undefined) fee.validUntil = patch.validUntil ?? undefined;
    applyCategoryJoin(fee);
    return fee;
  },
  async removeMemberFee(feeId) {
    const fee = feeStore.find((x) => x.id === feeId);
    if (fee) fee.deletedAt = new Date().toISOString();
    return { id: feeId };
  },
  async memberFeesSummary(clubId) {
    const active = feeStore.filter((f) => f.clubId === clubId && !f.deletedAt);
    const byPeriod: MemberFeesSummaryBucket[] = [];
    let totalAnnualCents = 0;
    for (const period of ["monthly", "quarterly", "yearly", "once"] as MembershipPeriod[]) {
      const rows = active.filter((f) => (f.categoryPeriod ?? "monthly") === period);
      if (rows.length === 0) continue;
      const amountCents = rows.reduce((sum, f) => sum + f.effectiveAmountCents, 0);
      const annualCents = amountCents * ANNUAL_FACTOR[period];
      totalAnnualCents += annualCents;
      byPeriod.push({ period, count: rows.length, amountCents, annualCents });
    }
    return { clubId, byPeriod, totalAnnualCents };
  },

  /* ---------- Familienrabatte ---------- */
  async listFamilyDiscounts(clubId) {
    return discountStore.filter((d) => d.clubId === clubId && !d.deletedAt);
  },
  async createFamilyDiscount(input) {
    const discount: FamilyDiscount = {
      id: `fd-local-${++discountSeq}`,
      clubId: input.clubId,
      label: input.label,
      kind: input.kind,
      valueNumeric: input.valueNumeric,
      appliesFromChild: input.appliesFromChild ?? 2,
      isActive: input.isActive ?? true,
    };
    discountStore.push(discount);
    return discount;
  },
  async updateFamilyDiscount(discountId, patch) {
    const discount = discountStore.find((x) => x.id === discountId);
    if (!discount) throw new ApiError(404, null, "family_discount_not_found");
    if (patch.label !== undefined) discount.label = patch.label;
    if (patch.kind !== undefined) discount.kind = patch.kind;
    if (patch.valueNumeric !== undefined) discount.valueNumeric = patch.valueNumeric;
    if (patch.appliesFromChild !== undefined) discount.appliesFromChild = patch.appliesFromChild;
    if (patch.isActive !== undefined) discount.isActive = patch.isActive;
    return discount;
  },
  async deleteFamilyDiscount(discountId) {
    const discount = discountStore.find((x) => x.id === discountId);
    if (discount) discount.deletedAt = new Date().toISOString();
    return { id: discountId };
  },

  /* ---------- SEPA-Mandate ---------- */
  async listSepaMandates(clubId, memberId) {
    return mandateStore.filter(
      (m) => m.clubId === clubId && !m.deletedAt && (!memberId || m.memberId === memberId),
    );
  },
  async createSepaMandate(input) {
    const mandate: SepaMandate = {
      id: `sm-local-${++mandateSeq}`,
      clubId: input.clubId,
      memberId: input.memberId,
      mandateReference: input.mandateReference,
      // DATENSCHUTZ: nur ibanLast4 — nie eine volle IBAN.
      ibanLast4: input.ibanLast4,
      accountHolder: input.accountHolder,
      signedOn: input.signedOn,
      status: input.status ?? "active",
    };
    mandateStore.push(mandate);
    return mandate;
  },
  async updateSepaMandate(mandateId, patch) {
    const mandate = mandateStore.find((x) => x.id === mandateId);
    if (!mandate) throw new ApiError(404, null, "sepa_mandate_not_found");
    if (patch.mandateReference !== undefined) mandate.mandateReference = patch.mandateReference;
    if (patch.ibanLast4 !== undefined) mandate.ibanLast4 = patch.ibanLast4 ?? undefined;
    if (patch.accountHolder !== undefined) mandate.accountHolder = patch.accountHolder;
    if (patch.signedOn !== undefined) mandate.signedOn = patch.signedOn ?? undefined;
    if (patch.status !== undefined) mandate.status = patch.status;
    return mandate;
  },
  async revokeSepaMandate(mandateId) {
    const mandate = mandateStore.find((x) => x.id === mandateId);
    if (!mandate) throw new ApiError(404, null, "sepa_mandate_not_found");
    mandate.status = "revoked";
    return mandate;
  },
  async removeSepaMandate(mandateId) {
    const mandate = mandateStore.find((x) => x.id === mandateId);
    if (mandate) mandate.deletedAt = new Date().toISOString();
    return { id: mandateId };
  },
};
