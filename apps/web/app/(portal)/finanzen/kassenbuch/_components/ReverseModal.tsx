"use client";

import { useState } from "react";
import { ApiError, data, errorMessage, isForbidden } from "@/lib/data";
import type { ReverseLedgerInput } from "@/lib/data";
import type { LedgerEntry } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { kassenbuchDict } from "../i18n";

/**
 * Storno-Bestätigung (GoBD): kein Löschen/Bearbeiten — data.reverseLedgerEntry
 * erzeugt eine Gegenbuchung mit umgekehrtem Vorzeichen. Doppel-/Reversal-Storno
 * beantwortet die Facade mit 409; das wird als ruhiger Klartext-Toast gezeigt,
 * NIE als Auto-Bestätigung. Erfolg → Toast + onReversed() + schließen.
 */
export function ReverseModal({
  entry,
  onClose,
  onReversed,
}: {
  entry: LedgerEntry;
  onClose: () => void;
  onReversed: () => void;
}) {
  const t = useT(kassenbuchDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reverseErrorMessage = (caught: unknown): string => {
    if (caught instanceof ApiError && caught.status === 409) {
      const code = caught.problem?.detail ?? caught.message;
      return code.includes("cannot_reverse_reversal")
        ? t("cannotReverseReversal")
        : t("alreadyReversed");
    }
    return isForbidden(caught) ? t("forbidden") : errorMessage(caught);
  };

  const submit = async () => {
    if (submitting) return;
    const input: ReverseLedgerInput = description.trim()
      ? { description: description.trim() }
      : {};
    setSubmitting(true);
    try {
      await data.reverseLedgerEntry(entry.id, input);
      showToast(t("reverseToast", { amount: formatEUR(-entry.amountCents, locale) }), {
        tone: "success",
      });
      onReversed();
      onClose();
    } catch (caught) {
      showToast(reverseErrorMessage(caught), { tone: "danger" });
      // 409 = bereits storniert: der Zustand ist veraltet, neu laden + schließen.
      if (caught instanceof ApiError && caught.status === 409) {
        onReversed();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("reverseEyebrow")}
      title={t("reverseTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={submitting}>
            {t("reverseConfirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-body text-ink-soft">{t("reverseIntro")}</p>

        <div className="grid gap-1 rounded-md border border-line bg-sunken px-4 py-3">
          <span className="eyebrow">{t("reverseOriginal")}</span>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[14px] font-semibold text-ink">
              {entry.description}
            </span>
            <span className="whitespace-nowrap font-mono text-mono-table font-bold tabular-nums text-ink">
              {formatEUR(entry.amountCents, locale)}
            </span>
          </div>
          <span className="text-caption text-ink-faint">
            {formatDateShort(entry.date, locale)}
          </span>
        </div>

        <Input
          label={t("reverseDescLabel")}
          placeholder={t("reverseDescPlaceholder")}
          hint={t("reverseDescHint")}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Modal>
  );
}
