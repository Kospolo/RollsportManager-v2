"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { ApiError, data, errorMessage, isClubProRequired, isForbidden } from "@/lib/data";
import { useLocale, useT } from "@/lib/i18n";
import { documentsDict } from "../i18n";
import { formatBytes, MAX_UPLOAD_BYTES } from "../fileType";

const FORM_ID = "document-upload-form";

/** Vorschläge fürs Datei-Auswahlfenster (Server erzwingt die echte Allowlist). */
const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp," +
  "application/pdf,image/*";

type FieldErrors = Partial<Record<"file" | "title", string>>;

/**
 * „Dokument hochladen"-Dialog (Trainer + PRO). Der Upload ist zweistufig und in
 * der Facade gekapselt: data.uploadDocument(file, meta) lädt die Datei per
 * multipart an POST /media/upload und legt danach die Zeile über POST /documents
 * an. Fehler werden als Klartext-Toast übersetzt: 402 (kein PRO), 403 (kein
 * Trainer), 413 (> 25 MB), 415 (Dateityp). Nach Erfolg → onUploaded()-Reload.
 */
export function DocumentUploadDialog({
  open,
  categories,
  onClose,
  onUploaded,
}: {
  open: boolean;
  /** Bereits vorhandene Kategorien als Datalist-Vorschläge. */
  categories: string[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const t = useT(documentsDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Beim Öffnen zurücksetzen.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setTitle("");
    setCategory("");
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  function pickFile(next: File | null) {
    setFile(next);
    setErrors((previous) => ({ ...previous, file: undefined }));
    // Titel aus Dateinamen vorbelegen, wenn noch leer.
    if (next && !title.trim()) {
      setTitle(next.name.replace(/\.[a-z0-9]{1,5}$/i, ""));
    }
  }

  function toastForError(error: unknown) {
    if (isClubProRequired(error)) return showToast(t("proTitle"), { tone: "danger" });
    if (isForbidden(error)) return showToast(t("noPermission"), { tone: "danger" });
    if (error instanceof ApiError && error.status === 413)
      return showToast(t("errTooLarge"), { tone: "danger" });
    if (error instanceof ApiError && error.status === 415)
      return showToast(t("errType"), { tone: "danger" });
    return showToast(errorMessage(error), { tone: "danger" });
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!file) nextErrors.file = t("errFile");
    else if (file.size > MAX_UPLOAD_BYTES) nextErrors.file = t("errTooLarge");
    if (!title.trim()) nextErrors.title = t("errTitle");
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !file) return;

    setSubmitting(true);
    try {
      const trimmedCategory = category.trim();
      const created = await data.uploadDocument(file, {
        title: title.trim(),
        category: trimmedCategory || undefined,
      });
      showToast(t("uploadedToast", { title: created.title }), { tone: "success" });
      onUploaded();
      onClose();
    } catch (error) {
      toastForError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("uploadEyebrow")}
      title={t("uploadTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="download" disabled={submitting}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("fFile")}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(changeEvent) => pickFile(changeEvent.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? t("fFileChange") : t("fFileChoose")}
            </Button>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
              {file ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="check" className="ic h-3.5 w-3.5 flex-none text-success" />
                  {file.name}
                  <span className="text-ink-faint">· {formatBytes(file.size, locale)}</span>
                </span>
              ) : (
                <span className="text-ink-faint">{t("fFileEmpty")}</span>
              )}
            </span>
          </div>
          {errors.file ? (
            <p className="text-caption font-semibold text-danger">{errors.file}</p>
          ) : (
            <p className="text-caption text-ink-faint">{t("fFileHint")}</p>
          )}
        </div>

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

        <Input
          label={t("fCategory")}
          placeholder={t("fCategoryPh")}
          hint={t("fCategoryHint")}
          list="document-category-suggestions"
          value={category}
          onChange={(changeEvent) => setCategory(changeEvent.target.value)}
        />
        <datalist id="document-category-suggestions">
          {categories.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}
