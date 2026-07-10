"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isClubProRequired, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { GalleryItem } from "@/lib/types";
import { galerieDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das Soft-Löschen eines Galerie-Objekts. Wird NIE
 * automatisch bestätigt — der Löschlauf startet ausschließlich über den
 * expliziten „Endgültig löschen"-Klick. Erfolg: Toast + onDeleted() + schließen;
 * ein 402/403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteGalleryDialog({
  item,
  onClose,
  onDeleted,
}: {
  item: GalleryItem | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(galerieDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!item || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteGalleryItem(item.id);
      showToast(t("deletedToast"), { tone: "success" });
      onDeleted();
      onClose();
    } catch (error) {
      const message = isClubProRequired(error)
        ? t("errPro")
        : isForbidden(error)
          ? t("errForbidden")
          : errorMessage(error);
      showToast(message, { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={item ? t("deleteTitle", { title: item.title }) : ""}
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
