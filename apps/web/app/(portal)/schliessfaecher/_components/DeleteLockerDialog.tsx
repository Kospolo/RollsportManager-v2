"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Locker } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { schliessfaecherDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines Schließfachs (is_club_admin).
 * Wird BEWUSST nie automatisch bestätigt — der Löschlauf startet nur über den
 * expliziten Klick. Erfolg: Toast + onDeleted() + schließen; 403 bleibt als
 * Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteLockerDialog({
  locker,
  onClose,
  onDeleted,
}: {
  locker: Locker | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(schliessfaecherDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!locker || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteLocker(locker.id);
      showToast(t("deletedToast", { label: locker.label }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenManage") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={locker !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={locker ? t("deleteTitle", { label: locker.label }) : ""}
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
