"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Facility } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { belegungsplanDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen einer Halle. Es wird BEWUSST nie
 * automatisch bestätigt — der Löschlauf startet ausschließlich über den
 * expliziten „Halle löschen"-Klick. Erfolg: Toast + onDeleted() + schließen;
 * 403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteFacilityDialog({
  facility,
  onClose,
  onDeleted,
}: {
  facility: Facility | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(belegungsplanDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!facility || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteFacility(facility.id);
      showToast(t("facilityDeletedToast", { name: facility.name }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenFacility") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={facility !== null}
      onClose={onClose}
      eyebrow={t("facilityDeleteEyebrow")}
      title={facility ? t("facilityDeleteTitle", { name: facility.name }) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {t("facilityDeleteConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("facilityDeleteBody")}</p>
    </Modal>
  );
}
