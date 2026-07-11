"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateBankTransactionInput } from "@/lib/data";
import type { Id } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { bankabgleichDict } from "../i18n";
import { parseMagnitudeCents, todayISODate } from "../derive";

const FORM_ID = "bank-transaction-form";

type Direction = "in" | "out";

/**
 * „Umsatz erfassen"-Sheet: Datum, Art (Eingang/Ausgang → Vorzeichen), Betrag,
 * Verwendungszweck und Gegenpartei. Schreibt über data.createBankTransaction
 * (amountCents SIGNED). Erfolg → Toast + onSaved() + schließen; 403 →
 * Klartext-Toast, Sheet bleibt offen. GoBD: append-only.
 */
export function ManualEntrySheet({
  clubId,
  onClose,
  onSaved,
}: {
  clubId: Id;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(bankabgleichDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const today = useMemo(() => todayISODate(), []);

  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<Direction>("in");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [counterparty, setCounterparty] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const submit = async () => {
    if (submitting) return;
    const magnitude = parseMagnitudeCents(amount);
    const next: Record<string, string> = {};
    if (!date || date > today) next.date = t("errDate");
    if (magnitude === null) next.amount = t("errAmount");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const signedCents = direction === "in" ? magnitude! : -magnitude!;
    const input: CreateBankTransactionInput = {
      clubId,
      bookedOn: date,
      amountCents: signedCents,
      purpose: purpose.trim() || undefined,
      counterparty: counterparty.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await data.createBankTransaction(input);
      showToast(t("createToast", { amount: formatEUR(signedCents, locale) }), { tone: "success" });
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("meEyebrow")}
      title={t("meTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {t("createBtn")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t("fDate")}
          type="date"
          max={today}
          value={date}
          error={errors.date}
          onChange={(event) => {
            setDate(event.target.value);
            clearError("date");
          }}
        />

        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("fDirection")}</span>
          <FilterChips<Direction>
            label={t("fDirection")}
            value={direction}
            onChange={setDirection}
            options={[
              { value: "in", label: t("dirIn") },
              { value: "out", label: t("dirOut") },
            ]}
          />
        </div>

        <Input
          label={t("fAmount")}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          hint={t("fAmountHint")}
          value={amount}
          error={errors.amount}
          onChange={(event) => {
            setAmount(event.target.value);
            clearError("amount");
          }}
        />

        <Textarea
          label={t("fPurpose")}
          placeholder={t("fPurposePlaceholder")}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        />

        <Input
          label={t("fCounterparty")}
          placeholder={t("fCounterpartyPlaceholder")}
          value={counterparty}
          onChange={(event) => setCounterparty(event.target.value)}
        />

        <p className="text-caption text-ink-faint">{t("meGobd")}</p>
      </form>
    </Sheet>
  );
}
