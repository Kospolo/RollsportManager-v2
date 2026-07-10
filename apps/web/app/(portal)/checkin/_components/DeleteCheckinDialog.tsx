"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Checkin } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { checkinDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines Check-ins (nur Trainer:innen
 * sehen die Aktion). Wird BEWUSST nie automatisch bestätigt — der Löschlauf
 * startet ausschließlich über den expliziten Klick. Erfolg: Toast + onDeleted()
 * + schließen; ein 403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteCheckinDialog({
  checkin,
  onClose,
  onDeleted,
}: {
  checkin: Checkin | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(checkinDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!checkin || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteCheckin(checkin.id);
      showToast(t("deletedToast"), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("deleteForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={checkin !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={t("deleteTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {t("deleteConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("deleteBody")}</p>
    </Modal>
  );
}
