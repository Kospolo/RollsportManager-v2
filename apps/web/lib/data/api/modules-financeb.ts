import type { DataRepository } from "../types";
import { apiClient } from "./client";
import {
  mapFamilyDiscount,
  mapMemberFee,
  mapMemberFeesSummary,
  mapMembershipCategory,
  mapSepaMandate,
} from "./mappers-financeb";

/**
 * API-Implementierung der Finanz-B-Module (Beitragskategorien, Beitrags-
 * zuordnungen inkl. Summary, Familienrabatte, SEPA-Mandate). Ausgelagert aus
 * api/index.ts (< 400 Zeilen).
 *
 * Rechte SERVERSEITIG (RLS): Kategorien/Familienrabatte lesen = is_club_member,
 * schreiben = can_manage_finance. Beitragszuordnungen + SEPA-Mandate lesen =
 * can_manage_finance ODER can_act_for_member; die Summary ist strikt
 * can_manage_finance (Mitglied → 403). Fehler kommen als ApiError (RFC 7807).
 *
 * DATENSCHUTZ (SEPA): NUR ibanLast4 geht auf den Draht — eine volle IBAN lehnt
 * der Server (Zod-Regex) und die DB (CHECK) ab.
 */

/** Die 18 Finanz-B-Modul-Methoden — wird in apiRepository gespreizt. */
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

export const moduleApiRepositoryFinanceB: ModuleMethods = {
  /* ---------- Beitragskategorien ---------- */
  async listMembershipCategories(clubId) {
    const rows = await apiClient.getMembershipCategories({ club_id: clubId });
    return rows.map(mapMembershipCategory);
  },
  async createMembershipCategory(input) {
    const created = await apiClient.postMembershipCategories({
      club_id: input.clubId,
      name: input.name,
      amount_cents: input.amountCents,
      period: input.period,
      is_active: input.isActive,
      sort_order: input.sortOrder,
    });
    return mapMembershipCategory(created);
  },
  async updateMembershipCategory(categoryId, patch) {
    const updated = await apiClient.patchMembershipCategoriesByCategoryId(categoryId, {
      name: patch.name,
      amount_cents: patch.amountCents,
      period: patch.period,
      is_active: patch.isActive,
      sort_order: patch.sortOrder,
    });
    return mapMembershipCategory(updated);
  },
  async deleteMembershipCategory(categoryId) {
    const deleted = await apiClient.deleteMembershipCategoriesByCategoryId(categoryId);
    return { id: deleted.id };
  },

  /* ---------- Beitragszuordnungen ---------- */
  async listMemberFees(clubId, memberId) {
    const rows = await apiClient.getMemberFees({ club_id: clubId, member_id: memberId });
    return rows.map(mapMemberFee);
  },
  async assignMemberFee(input) {
    const created = await apiClient.postMemberFees({
      club_id: input.clubId,
      member_id: input.memberId,
      category_id: input.categoryId,
      custom_amount_cents: input.customAmountCents,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
    });
    return mapMemberFee(created);
  },
  async updateMemberFee(feeId, patch) {
    const updated = await apiClient.patchMemberFeesByFeeId(feeId, {
      category_id: patch.categoryId,
      custom_amount_cents: patch.customAmountCents,
      valid_from: patch.validFrom,
      valid_until: patch.validUntil,
    });
    return mapMemberFee(updated);
  },
  async removeMemberFee(feeId) {
    const deleted = await apiClient.deleteMemberFeesByFeeId(feeId);
    return { id: deleted.id };
  },
  async memberFeesSummary(clubId) {
    const summary = await apiClient.getMemberFeesSummary({ club_id: clubId });
    return mapMemberFeesSummary(summary);
  },

  /* ---------- Familienrabatte ---------- */
  async listFamilyDiscounts(clubId) {
    const rows = await apiClient.getFamilyDiscounts({ club_id: clubId });
    return rows.map(mapFamilyDiscount);
  },
  async createFamilyDiscount(input) {
    const created = await apiClient.postFamilyDiscounts({
      club_id: input.clubId,
      label: input.label,
      kind: input.kind,
      value_numeric: input.valueNumeric,
      applies_from_child: input.appliesFromChild,
      is_active: input.isActive,
    });
    return mapFamilyDiscount(created);
  },
  async updateFamilyDiscount(discountId, patch) {
    const updated = await apiClient.patchFamilyDiscountsByDiscountId(discountId, {
      label: patch.label,
      kind: patch.kind,
      value_numeric: patch.valueNumeric,
      applies_from_child: patch.appliesFromChild,
      is_active: patch.isActive,
    });
    return mapFamilyDiscount(updated);
  },
  async deleteFamilyDiscount(discountId) {
    const deleted = await apiClient.deleteFamilyDiscountsByDiscountId(discountId);
    return { id: deleted.id };
  },

  /* ---------- SEPA-Mandate ---------- */
  async listSepaMandates(clubId, memberId) {
    const rows = await apiClient.getSepaMandates({ club_id: clubId, member_id: memberId });
    return rows.map(mapSepaMandate);
  },
  async createSepaMandate(input) {
    // DATENSCHUTZ: NUR ibanLast4 — nie die volle IBAN.
    const created = await apiClient.postSepaMandates({
      club_id: input.clubId,
      member_id: input.memberId,
      mandate_reference: input.mandateReference,
      iban_last4: input.ibanLast4,
      account_holder: input.accountHolder,
      signed_on: input.signedOn,
      status: input.status,
    });
    return mapSepaMandate(created);
  },
  async updateSepaMandate(mandateId, patch) {
    const updated = await apiClient.patchSepaMandatesByMandateId(mandateId, {
      mandate_reference: patch.mandateReference,
      iban_last4: patch.ibanLast4,
      account_holder: patch.accountHolder,
      signed_on: patch.signedOn,
      status: patch.status,
    });
    return mapSepaMandate(updated);
  },
  async revokeSepaMandate(mandateId) {
    // Widerruf = Status auf 'revoked' patchen (Kurzform).
    const updated = await apiClient.patchSepaMandatesByMandateId(mandateId, {
      status: "revoked",
    });
    return mapSepaMandate(updated);
  },
  async removeSepaMandate(mandateId) {
    const deleted = await apiClient.deleteSepaMandatesByMandateId(mandateId);
    return { id: deleted.id };
  },
};
