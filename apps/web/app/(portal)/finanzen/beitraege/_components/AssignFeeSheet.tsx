"use client";

import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Id, Member, MemberFee, MembershipCategory } from "@/lib/types";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { memberFeesDict } from "../i18n";
import {
  PERIOD_LABEL_KEY,
  PERIOD_SUFFIX_KEY,
  centsToEuroInput,
  parseEuroToCents,
} from "../derive";

/**
 * „Beitrag zuordnen/ändern" — Sheet mit Formular (Kategorie, optionaler
 * Sonderbetrag, Gültigkeit) über die Facade (assignMemberFee/updateMemberFee).
 * Bei bestehender Zuordnung zusätzlich „entfernen" (removeMemberFee, Soft-
 * Delete) mit Inline-Bestätigung — nie ein automatisch bestätigtes Löschen.
 * Rechte sind serverseitig (can_manage_finance); ein 403 wird als Toast
 * behandelt, nicht als Absturz.
 */
export function AssignFeeSheet({
  open,
  onClose,
  clubId,
  member,
  categories,
  existingFee,
  onSaved,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  clubId: Id;
  member: Member;
  /** Aktive Beitragskategorien (Dropdown-Quelle). */
  categories: MembershipCategory[];
  /** Vorhandene Zuordnung (→ Ändern) oder undefined (→ Neu zuordnen). */
  existingFee?: MemberFee;
  /** Zugeordnete/aktualisierte Zuordnung — Overlay im Parent. */
  onSaved: (fee: MemberFee) => void;
  /** Zuordnung entfernt — Overlay im Parent. */
  onRemoved: (memberId: Id) => void;
}) {
  const t = useT(memberFeesDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const today = new Date().toISOString().slice(0, 10);

  const [categoryId, setCategoryId] = useState<string>(existingFee?.categoryId ?? "");
  const [custom, setCustom] = useState<string>(
    existingFee?.customAmountCents != null ? centsToEuroInput(existingFee.customAmountCents) : "",
  );
  const [validFrom, setValidFrom] = useState<string>(existingFee?.validFrom ?? today);
  const [validUntil, setValidUntil] = useState<string>(existingFee?.validUntil ?? "");
  const [errors, setErrors] = useState<{
    category?: string;
    custom?: string;
    from?: string;
    until?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isEdit = existingFee !== undefined;
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Live-Vorschau des effektiven Beitrags (custom ?? Kategorie-Betrag).
  const customCents = custom.trim() ? parseEuroToCents(custom) : null;
  const effectiveCents =
    customCents ?? (custom.trim() ? null : selectedCategory?.amountCents ?? null);
  const previewSuffix = selectedCategory
    ? t(PERIOD_SUFFIX_KEY[selectedCategory.period])
    : "";

  const submit = async () => {
    if (submitting) return;
    const nextErrors: typeof errors = {};
    if (!categoryId) nextErrors.category = t("fCategoryError");
    if (custom.trim() && parseEuroToCents(custom) === null) nextErrors.custom = t("fCustomError");
    if (!validFrom) nextErrors.from = t("fFromError");
    if (validUntil && validFrom && validUntil < validFrom) nextErrors.until = t("fUntilError");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const customAmountCents = custom.trim() ? parseEuroToCents(custom) : null;
    setSubmitting(true);
    try {
      let saved: MemberFee;
      if (existingFee) {
        saved = await data.updateMemberFee(existingFee.id, {
          categoryId,
          customAmountCents,
          validFrom,
          validUntil: validUntil || null,
        });
      } else {
        saved = await data.assignMemberFee({
          clubId,
          memberId: member.id,
          categoryId,
          customAmountCents: customAmountCents ?? undefined,
          validFrom,
          validUntil: validUntil || undefined,
        });
      }
      onSaved(saved);
      showToast(
        isEdit
          ? t("toastUpdated", { name: fullName(member) })
          : t("toastAssigned", {
              name: fullName(member),
              category: saved.categoryName ?? selectedCategory?.name ?? "",
            }),
        { tone: "success" },
      );
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (submitting || !existingFee) return;
    setSubmitting(true);
    try {
      await data.removeMemberFee(existingFee.id);
      onRemoved(member.id);
      showToast(t("toastRemoved", { name: fullName(member) }), { tone: "success" });
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t("assignEyebrow")}
      title={isEdit ? t("assignTitleEdit") : t("assignTitleNew")}
      footer={
        <>
          {/* Entfernen gehört in die Fußzeile: dort ist es IMMER sichtbar. Vorher
              stand es unten im Sheet-Body und war unter der Falz — der Vorstand
              dachte, Löschen fehle ganz. Der Bestätigungsschritt bleibt (nie
              ohne Rückfrage löschen). */}
          {isEdit &&
            (confirmRemove ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-[13px] font-bold text-ink">{t("removeConfirmQ")}</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)} disabled={submitting}>
                  {t("removeConfirmNo")}
                </Button>
                <Button variant="danger" size="sm" onClick={remove} disabled={submitting}>
                  {t("removeConfirmYes")}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon="trash"
                className="mr-auto text-danger"
                onClick={() => setConfirmRemove(true)}
                disabled={submitting}
              >
                {t("removeAction")}
              </Button>
            ))}
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            icon={isEdit ? "check" : "plus"}
            onClick={submit}
            disabled={submitting || categories.length === 0}
          >
            {isEdit ? t("saveEdit") : t("saveNew")}
          </Button>
        </>
      }
    >
      <p className="mb-4 flex items-center gap-2 text-[13px] text-ink-soft">
        <span className="font-semibold text-ink">{fullName(member)}</span>
      </p>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Select
          label={t("fCategory")}
          value={categoryId}
          error={errors.category}
          disabled={categories.length === 0}
          hint={categories.length === 0 ? t("fCategoryEmpty") : undefined}
          onChange={(event) => {
            setCategoryId(event.target.value);
            if (errors.category) setErrors((e) => ({ ...e, category: undefined }));
          }}
        >
          <option value="" disabled>
            {t("fCategoryPlaceholder")}
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {`${cat.name} · ${formatEUR(cat.amountCents, locale)} (${t(PERIOD_LABEL_KEY[cat.period])})`}
            </option>
          ))}
        </Select>

        <Input
          label={t("fCustom")}
          inputMode="decimal"
          placeholder={
            selectedCategory ? centsToEuroInput(selectedCategory.amountCents) : "0,00"
          }
          hint={
            selectedCategory
              ? t("fCustomHint", { amount: formatEUR(selectedCategory.amountCents, locale) })
              : t("fCustomHintNoCat")
          }
          error={errors.custom}
          value={custom}
          onChange={(event) => {
            setCustom(event.target.value);
            if (errors.custom) setErrors((e) => ({ ...e, custom: undefined }));
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fFrom")}
            type="date"
            value={validFrom}
            error={errors.from}
            onChange={(event) => {
              setValidFrom(event.target.value);
              if (errors.from) setErrors((e) => ({ ...e, from: undefined }));
            }}
          />
          <Input
            label={t("fUntil")}
            type="date"
            hint={t("fUntilHint")}
            value={validUntil}
            error={errors.until}
            onChange={(event) => {
              setValidUntil(event.target.value);
              if (errors.until) setErrors((e) => ({ ...e, until: undefined }));
            }}
          />
        </div>

        {/* Live-Vorschau des effektiven Beitrags (Mono/tabular) */}
        <div className="flex items-center justify-between rounded-md bg-sunken px-4 py-3">
          <span className="text-[13px] font-bold text-ink-soft">{t("effectivePreview")}</span>
          <span className="font-mono text-mono-table tabular-nums text-ink">
            {effectiveCents != null
              ? `${formatEUR(effectiveCents, locale)}${previewSuffix ? ` ${previewSuffix}` : ""}`
              : t("dash")}
          </span>
        </div>

        {/* Enter im Formular löst „Speichern" aus */}
        <button type="submit" className="sr-only">
          {isEdit ? t("saveEdit") : t("saveNew")}
        </button>
      </form>

    </Sheet>
  );
}
