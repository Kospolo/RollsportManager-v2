"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Equipment } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ausruestungDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines Gegenstands. Wird BEWUSST nie
 * automatisch bestätigt — der Löschlauf startet nur über den expliziten Klick.
 * Erfolg: Toast + onDeleted() + schließen; 403 bleibt als Klartext-Toast, der
 * Dialog bleibt offen.
 */
export function DeleteEquipmentDialog({
  equipment,
  onClose,
  onDeleted,
}: {
  equipment: Equipment | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(ausruestungDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!equipment || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteEquipment(equipment.id);
      showToast(t("deletedToast", { name: equipment.name }), { tone: "success" });
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
      open={equipment !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={equipment ? t("deleteTitle", { name: equipment.name }) : ""}
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
