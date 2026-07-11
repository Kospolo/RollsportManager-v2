"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { UpsertBudgetInput } from "@/lib/data";
import { useT, useLocale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { budgetDict } from "../i18n";
import { centsToAmountInput, parseAmountToCents, type BudgetRow } from "../derive";

/**
 * Anlege-/Bearbeiten-Dialog einer Budget-Planzeile (Upsert je Verein/Jahr/
 * Kategorie). Ist eine budgetId vorhanden → PATCH, sonst POST. Der Euro-Betrag
 * wird verlustfrei in Integer-Cent geparst. Schreibt über die Facade
 * (data.upsertBudget); onSaved lädt den Screen neu. 403 → sauberer Toast, die
 * echte Durchsetzung bleibt serverseitig (can_manage_finance).
 */
export function BudgetPlanModal({
  year,
  row,
  onClose,
  onSaved,
}: {
  year: number;
  row: BudgetRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(budgetDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const isEdit = row.hasPlan;

  const [amount, setAmount] = useState(
    row.hasPlan ? centsToAmountInput(row.plannedCents, locale) : "",
  );
  const [note, setNote] = useState(row.note ?? "");
  const [amountError, setAmountError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const plannedCents = parseAmountToCents(amount);
    if (plannedCents === null) {
      setAmountError(t("planAmountError"));
      return;
    }

    setSubmitting(true);
    try {
      const trimmedNote = note.trim();
      const input: UpsertBudgetInput = {
        year,
        categoryId: row.categoryId,
        plannedCents,
        note: trimmedNote ? trimmedNote : null,
        ...(row.budgetId ? { id: row.budgetId } : {}),
      };
      await data.upsertBudget(input);
      showToast(t(isEdit ? "planUpdatedToast" : "planCreatedToast", { name: row.categoryName }), {
        tone: "success",
      });
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={submitting ? () => {} : onClose}
      eyebrow={t("planEyebrow")}
      title={isEdit ? t("planEditTitle") : t("planCreateTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="budget-plan-form" icon="check" disabled={submitting}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form
        id="budget-plan-form"
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("planCategoryLabel")}</span>
          <p className="rounded-md bg-sunken px-4 py-2.5 text-body font-semibold text-ink">
            {row.categoryName}
          </p>
        </div>
        <Input
          label={t("planAmountLabel")}
          hint={t("planAmountHint", { year })}
          error={amountError}
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            if (amountError) setAmountError(undefined);
          }}
        />
        <Textarea
          label={t("planNoteLabel")}
          placeholder={t("planNotePlaceholder")}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </form>
    </Modal>
  );
}
