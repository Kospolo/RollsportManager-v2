"use client";

import { useState } from "react";
import { ApiError, data, errorMessage, isForbidden } from "@/lib/data";
import type { SepaMandate } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { sepaDict } from "../i18n";

/**
 * Widerruf-Bestätigung: KEIN Löschen — data.revokeSepaMandate setzt den Status
 * auf „revoked", das Mandat bleibt zur Nachverfolgung erhalten. Die Aktion wird
 * NIE automatisch bestätigt; erst der Klick auf „Mandat widerrufen" löst sie
 * aus. Erfolg → Toast + onRevoked() + schließen. Ein 409 (bereits widerrufen)
 * ist veralteter Zustand → ruhiger Toast, neu laden + schließen.
 */
export function RevokeModal({
  mandate,
  memberName,
  onClose,
  onRevoked,
}: {
  mandate: SepaMandate;
  memberName: string;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const t = useT(sepaDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await data.revokeSepaMandate(mandate.id);
      showToast(t("revokedToast", { reference: mandate.mandateReference }), {
        tone: "success",
      });
      onRevoked();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        showToast(t("alreadyRevoked"), { tone: "danger" });
        onRevoked();
        onClose();
      } else {
        showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), {
          tone: "danger",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("revokeEyebrow")}
      title={t("revokeTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={submitting}>
            {t("revokeConfirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-body text-ink-soft">{t("revokeIntro")}</p>

        <div className="grid gap-1 rounded-md border border-line bg-sunken px-4 py-3">
          <span className="eyebrow">{t("revokeMandateLabel")}</span>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[14px] font-semibold text-ink">{memberName}</span>
            <span className="whitespace-nowrap font-mono text-mono-table font-bold tabular-nums text-ink">
              {mandate.mandateReference}
            </span>
          </div>
          <span className="text-caption text-ink-faint">
            {mandate.ibanLast4 ? `•••• ${mandate.ibanLast4}` : t("valueUnknown")}
            {mandate.signedOn ? ` · ${formatDateShort(mandate.signedOn, locale)}` : ""}
          </span>
        </div>
      </div>
    </Modal>
  );
}
