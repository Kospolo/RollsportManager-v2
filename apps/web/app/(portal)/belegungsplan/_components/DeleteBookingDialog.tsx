"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { FacilityBooking } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { belegungsplanDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen einer Buchung. Löschen darf
 * serverseitig nur Ersteller:in ODER Trainer:in — die Sichtbarkeit der Aktion
 * ist Komfort, ein 403 kommt als Klartext-Toast zurück. Nie automatisch
 * bestätigt: der Löschlauf startet nur über den expliziten Klick.
 */
export function DeleteBookingDialog({
  booking,
  onClose,
  onDeleted,
}: {
  booking: FacilityBooking | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(belegungsplanDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!booking || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteBooking(booking.id);
      showToast(t("bookingDeletedToast", { title: booking.title }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenBookingDelete") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={booking !== null}
      onClose={onClose}
      eyebrow={t("bookingDeleteEyebrow")}
      title={booking ? t("bookingDeleteTitle", { title: booking.title }) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {t("bookingDeleteConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("bookingDeleteBody")}</p>
    </Modal>
  );
}
