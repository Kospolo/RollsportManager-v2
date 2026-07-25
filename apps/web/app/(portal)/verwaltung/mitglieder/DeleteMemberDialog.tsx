"use client";

import { useState } from "react";
import { ApiError, data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { mitgliederVerwaltungDict } from "./i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines Mitglieds. BEWUSST ein echter
 * Dialog (nie window.confirm) und nie automatisch bestätigt — der Löschlauf
 * startet nur über den expliziten Klick. Erfolg: Toast + onDeleted() + schließen.
 * 409 (letzter aktiver Vorstand/Owner) und 403 bekommen einen eigenen Klartext;
 * der Dialog bleibt bei Fehlern offen.
 */
export function DeleteMemberDialog({
  member,
  onClose,
  onDeleted,
}: {
  member: Member | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(mitgliederVerwaltungDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!member || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteMember(member.id);
      showToast(t("deletedToast", { name: fullName(member) }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      // 409 = letztes aktives owner-Mitglied (serverseitig geschützt) → eigener
      // Hinweis; 403 = keine Berechtigung; sonst die Server-Meldung.
      const message =
        caught instanceof ApiError && caught.status === 409
          ? t("deleteLastOwner")
          : isForbidden(caught)
            ? t("deleteForbidden")
            : errorMessage(caught);
      showToast(message, { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={member ? t("deleteTitle", { name: fullName(member) }) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={submitting}>
            {t("deleteConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("deleteBody")}</p>
    </Modal>
  );
}
