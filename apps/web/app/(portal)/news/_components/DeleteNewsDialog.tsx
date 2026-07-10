"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { News } from "@/lib/types";
import { newsDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen einer Neuigkeit. Wird NIE
 * automatisch bestätigt — der Löschlauf startet ausschließlich über den
 * expliziten „Endgültig löschen“-Klick. Erfolg: Toast + onDeleted() +
 * schließen; ein 403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteNewsDialog({
  news,
  onClose,
  onDeleted,
}: {
  news: News | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(newsDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!news || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteNews(news.id);
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
      open={news !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={news ? t("deleteTitle", { title: news.title }) : ""}
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
