"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Department } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { abteilungenDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen einer Abteilung. Wird BEWUSST nie
 * automatisch bestätigt — der Löschlauf startet nur über den expliziten Klick.
 * Erfolg: Toast + onDeleted() + schließen; 403 bleibt als Klartext-Toast, der
 * Dialog bleibt offen.
 */
export function DeleteDepartmentDialog({
  department,
  onClose,
  onDeleted,
}: {
  department: Department | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(abteilungenDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!department || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteDepartment(department.id);
      showToast(t("deletedToast", { name: department.name }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={department !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={department ? t("deleteTitle", { name: department.name }) : ""}
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
