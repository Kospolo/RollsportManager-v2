"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import type { ChatMessage } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { chatDict } from "./i18n";

/**
 * „Nachricht melden" — meldet eine FREMDE Nachricht als Verstoss an den
 * Vereinsvorstand (und den Betreiber). Der Melder, seine IP und ein Snapshot
 * des Nachrichtentexts werden SERVERSEITIG festgehalten (POST /chat/reports) —
 * die UI reicht nur Nachricht-ID und Grund weiter. Es wird nie automatisch
 * bestätigt; gemeldet wird ausschliesslich über den expliziten Klick. Erfolg:
 * Toast + schliessen; ein Fehler bleibt als Klartext-Toast, der Dialog offen.
 */
export function ReportMessageDialog({
  message,
  onClose,
  onReported,
}: {
  message: ChatMessage | null;
  onClose: () => void;
  onReported?: () => void;
}) {
  const t = useT(chatDict);
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const close = () => {
    setReason("");
    setTouched(false);
    onClose();
  };

  const confirm = async () => {
    if (!message || submitting) return;
    if (reason.trim().length === 0) {
      setTouched(true);
      return;
    }
    setSubmitting(true);
    try {
      await data.reportChatMessage({ messageId: message.id, reason: reason.trim() });
      showToast(t("reportedToast"), { tone: "success" });
      onReported?.();
      close();
    } catch (caught) {
      showToast(errorMessage(caught) || t("reportError"), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={message !== null}
      onClose={close}
      eyebrow={t("reportEyebrow")}
      title={t("reportTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {t("reportSubmit")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <p className="text-body text-ink-soft">{t("reportBody")}</p>
        <Textarea
          label={t("reportReasonLabel")}
          placeholder={t("reportReasonPlaceholder")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={touched && reason.trim().length === 0 ? t("reportReasonRequired") : undefined}
          maxLength={2000}
          rows={4}
        />
      </div>
    </Modal>
  );
}
