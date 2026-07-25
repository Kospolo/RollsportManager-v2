"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import type { Id } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { meldungenDict } from "./i18n";

/**
 * Nachricht an den Melder ODER die gemeldete Person — nutzt den BESTEHENDEN
 * DM-Weg (data.sendChatMessage, channelType 'direct'). Kein neuer Nachrichten-
 * pfad; die Kinderschutz-Regel (0043) bleibt serverseitig die Wahrheit: ist die
 * Direktnachricht an eine minderjährige Person nicht erlaubt, meldet der Server
 * das als Fehler zurück, den der Dialog als Klartext-Toast zeigt.
 */
export function SendMessageDialog({
  recipient,
  onClose,
  onSent,
}: {
  recipient: { id: Id; name: string } | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const t = useT(meldungenDict);
  const { showToast } = useToast();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const close = () => {
    setBody("");
    setTouched(false);
    onClose();
  };

  const send = async () => {
    if (!recipient || submitting) return;
    if (body.trim().length === 0) {
      setTouched(true);
      return;
    }
    setSubmitting(true);
    try {
      await data.sendChatMessage({
        channelType: "direct",
        recipientMemberId: recipient.id,
        body: body.trim(),
      });
      showToast(t("sentToast"), { tone: "success" });
      onSent?.();
      close();
    } catch (caught) {
      showToast(errorMessage(caught) || t("sendError"), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={recipient !== null}
      onClose={close}
      eyebrow={t("sendEyebrow")}
      title={t("sendTitle", { name: recipient?.name ?? "" })}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button icon="mail" onClick={send} disabled={submitting}>
            {t("sendSubmit")}
          </Button>
        </>
      }
    >
      <Textarea
        label={t("sendLabel")}
        placeholder={t("sendPlaceholder")}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        error={touched && body.trim().length === 0 ? t("sendRequired") : undefined}
        maxLength={4000}
        rows={5}
      />
    </Modal>
  );
}
