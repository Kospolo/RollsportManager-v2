"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { DocumentItem } from "@/lib/types";
import { documentsDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines Dokuments. Wird NIE
 * automatisch bestätigt — der Löschlauf startet ausschließlich über den
 * expliziten „Endgültig löschen"-Klick. Erfolg: Toast + onDeleted() + schließen;
 * ein 403 bleibt als Klartext-Toast, der Dialog bleibt offen (Trainer + PRO).
 */
export function DeleteDocumentDialog({
  document: doc,
  onClose,
  onDeleted,
}: {
  document: DocumentItem | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(documentsDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!doc || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteDocument(doc.id);
      showToast(t("deletedToast"), { tone: "success" });
      onDeleted();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={doc !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={doc ? t("deleteTitle", { title: doc.title }) : ""}
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
