"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { News } from "@/lib/types";
import { newsDict } from "../i18n";

const FORM_ID = "news-form";

type FieldErrors = Partial<Record<"title" | "body", string>>;

/**
 * „Nachricht verfassen / bearbeiten“-Formular als Sheet. Schreibt über die
 * Facade (api-Modus: POST/PATCH /news, mock: In-Memory). `editing` schaltet
 * zwischen Anlegen (null) und Bearbeiten (News) um; nach Erfolg löst der
 * Screen über onSaved einen Reload aus. Schreiben ist serverseitig auf
 * is_club_trainer beschränkt — ein 403 kommt als Klartext-Toast zurück.
 */
export function NewsFormSheet({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = neue Nachricht, News = bestehende bearbeiten */
  editing: News | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(newsDict);
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Beim Öffnen aus dem aktuellen Datensatz vorbelegen (oder leeren beim Anlegen).
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setBody(editing?.body ?? "");
    setIsPinned(editing?.isPinned ?? false);
    setErrors({});
  }, [open, editing]);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;
    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = t("errTitle");
    if (!body.trim()) nextErrors.body = t("errBody");
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const saved = editing
        ? await data.updateNews(editing.id, {
            title: title.trim(),
            body: body.trim(),
            isPinned,
          })
        : await data.createNews({
            title: title.trim(),
            body: body.trim(),
            isPinned,
          });
      showToast(t(editing ? "updatedToast" : "createdToast", { title: saved.title }), {
        tone: "success",
      });
      onSaved();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={editing ? t("formEyebrowEdit") : t("formEyebrowCreate")}
      title={editing ? t("formTitleEdit") : t("formTitleCreate")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            icon={editing ? "check" : "plus"}
            disabled={submitting}
          >
            {editing ? t("submitEdit") : t("submitCreate")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <Input
          label={t("fTitle")}
          placeholder={t("fTitlePh")}
          value={title}
          error={errors.title}
          onChange={(changeEvent) => {
            setTitle(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, title: undefined }));
          }}
        />

        <Textarea
          label={t("fBody")}
          placeholder={t("fBodyPh")}
          rows={7}
          value={body}
          error={errors.body}
          onChange={(changeEvent) => {
            setBody(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, body: undefined }));
          }}
        />

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold text-ink">{t("fPin")}</span>
            <Switch
              checked={isPinned}
              onChange={setIsPinned}
              label={t("fPin")}
              words={{ on: t("pinOn"), off: t("pinOff") }}
            />
          </div>
          <p className="text-caption text-ink-faint">{t("fPinHint")}</p>
        </div>
      </form>
    </Sheet>
  );
}
