"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { TrainingSlot } from "@/lib/types";
import { weekdayLabels } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { trainingsplanDict } from "../i18n";
import { slotTimeRange } from "../helpers";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen einer Trainingszeit. Es wird
 * BEWUSST nie automatisch bestätigt — der Löschlauf startet ausschließlich über
 * den expliziten „Zeit löschen"-Klick. Erfolg: Toast + onDeleted() + schließen;
 * 403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteSlotDialog({
  slot,
  onClose,
  onDeleted,
}: {
  slot: TrainingSlot | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(trainingsplanDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const slotLabel = slot
    ? `${weekdayLabels[slot.weekday][locale]} ${slotTimeRange(slot)}`
    : "";

  const confirm = async () => {
    if (!slot || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteTrainingSlot(slot.id);
      showToast(t("deletedToast", { slot: slotLabel }), { tone: "success" });
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
      open={slot !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={slot ? t("deleteTitle", { slot: slotLabel }) : ""}
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
