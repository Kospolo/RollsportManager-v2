"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { RegionalEvent } from "@/lib/types";
import { eventsDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines überregionalen Events. Wird
 * NIE automatisch bestätigt — der Löschlauf startet ausschließlich über den
 * expliziten „Endgültig löschen“-Klick. Erfolg: Toast + onDeleted() +
 * schließen; ein 403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteRegionalEventDialog({
  event,
  onClose,
  onDeleted,
}: {
  event: RegionalEvent | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(eventsDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!event || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteRegionalEvent(event.id);
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
      open={event !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={event ? t("deleteTitle", { title: event.title }) : ""}
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
