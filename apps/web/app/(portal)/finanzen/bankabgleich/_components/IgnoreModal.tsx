"use client";

import { useState } from "react";
import { ApiError, data, errorMessage, isForbidden } from "@/lib/data";
import type { BankTransaction } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { bankabgleichDict } from "../i18n";

/**
 * „Umsatz ignorieren"-Bestätigung: KEIN Löschen — data.ignoreBankTransaction
 * setzt den Status auf „ignored", der Umsatz bleibt erhalten (GoBD) und über
 * den Filter einsehbar. Die Aktion wird NIE automatisch bestätigt; erst der
 * Klick auf „Ignorieren" löst sie aus. Ein 409 (bereits zugeordnet) ist
 * veralteter Zustand → ruhiger Toast, neu laden + schließen.
 */
export function IgnoreModal({
  transaction,
  onClose,
  onIgnored,
}: {
  transaction: BankTransaction;
  onClose: () => void;
  onIgnored: () => void;
}) {
  const t = useT(bankabgleichDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await data.ignoreBankTransaction(transaction.id, { note: note.trim() || undefined });
      showToast(t("ignoreToast"), { tone: "success" });
      onIgnored();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        showToast(t("errAlreadyMatched"), { tone: "danger" });
        onIgnored();
        onClose();
      } else {
        showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("ignoreEyebrow")}
      title={t("ignoreTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={submitting}>
            {t("ignoreConfirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-body text-ink-soft">{t("ignoreIntro")}</p>

        <div className="grid gap-1 rounded-md border border-line bg-sunken px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[14px] font-semibold text-ink">
              {transaction.counterparty || t("noCounterparty")}
            </span>
            <span
              className={`whitespace-nowrap font-mono text-mono-table font-bold tabular-nums ${
                transaction.amountCents > 0 ? "text-success" : "text-danger"
              }`}
            >
              {transaction.amountCents > 0 ? "+" : ""}
              {formatEUR(transaction.amountCents, locale)}
            </span>
          </div>
          <span className="text-caption text-ink-faint">
            {formatDateShort(transaction.bookedOn, locale)}
            {transaction.purpose ? ` · ${transaction.purpose}` : ""}
          </span>
        </div>

        <Textarea
          label={t("ignoreNoteLabel")}
          placeholder={t("ignoreNotePlaceholder")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  );
}
