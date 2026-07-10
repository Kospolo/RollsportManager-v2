"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  ApiError,
  data,
  errorMessage,
  isClubProRequired,
  isForbidden,
} from "@/lib/data";
import { useT } from "@/lib/i18n";
import { galerieDict } from "../i18n";
import { MAX_UPLOAD_BYTES, isVideoType } from "./media";

const FORM_ID = "gallery-upload-form";

type FieldErrors = Partial<Record<"file" | "title", string>>;

/** Menschliche Meldung für die typischen Upload-Fehler (402/403/413/415). */
function uploadErrorText(error: unknown, t: (k: keyof (typeof galerieDict)["de"]) => string): string {
  if (isClubProRequired(error)) return t("errPro");
  if (isForbidden(error)) return t("errForbidden");
  if (error instanceof ApiError) {
    if (error.status === 413) return t("errTooLarge");
    if (error.status === 415) return t("errType");
  }
  return errorMessage(error);
}

/**
 * „Foto oder Video hochladen"-Sheet (Trainer+PRO). Der Upload ist über die
 * Facade gekapselt und ZWEISTUFIG: uploadGalleryItem lädt die Datei per
 * multipart an POST /media/upload und legt danach die Galerie-Zeile an (POST
 * /gallery). Client-seitige Vorprüfung (Typ + 25 MB) verhindert offensichtliche
 * Fehler; die verbindliche Allowlist bleibt serverseitig (402/403/413/415 →
 * Klartext-Toast). Nach Erfolg löst der Screen über onUploaded einen Reload aus.
 */
export function UploadGalleryDialog({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const t = useT(galerieDict);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [album, setAlbum] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Beim Öffnen/Schließen zurücksetzen und lokale Vorschau-URL freigeben.
  useEffect(() => {
    if (open) {
      setFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setTitle("");
      setAlbum("");
      setErrors({});
    }
  }, [open]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function pickFile(next: File | null) {
    setErrors((prev) => ({ ...prev, file: undefined }));
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (!next) {
      setFile(null);
      return;
    }
    const type = next.type || "";
    if (!type.startsWith("image/") && !type.startsWith("video/")) {
      setFile(null);
      setErrors((prev) => ({ ...prev, file: t("errFileType") }));
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setErrors((prev) => ({ ...prev, file: t("errFileSize") }));
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    // Titel-Vorschlag aus dem Dateinamen (ohne Endung), wenn noch leer.
    setTitle((current) => current || next.name.replace(/\.[^.]+$/, ""));
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!file) nextErrors.file = t("errFile");
    if (!title.trim()) nextErrors.title = t("errTitle");
    setErrors(nextErrors);
    if (!file || Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const created = await data.uploadGalleryItem(file, {
        title: title.trim(),
        album: album.trim() || undefined,
      });
      showToast(t("createdToast", { title: created.title }), { tone: "success" });
      onUploaded();
      onClose();
    } catch (error) {
      showToast(uploadErrorText(error, t), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  const previewIsVideo = file ? isVideoType(file.type) : false;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t("formEyebrow")}
      title={t("formTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="plus" disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
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
            accept="image/*,video/*"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {file && previewUrl ? (
            <div className="relative overflow-hidden rounded-lg border border-line bg-sunken">
              <div className="grid max-h-56 place-items-center">
                {previewIsVideo ? (
                  <video src={previewUrl} controls playsInline className="max-h-56 w-full bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- lokale Object-URL
                  <img
                    src={previewUrl}
                    alt={t("previewAlt")}
                    className="max-h-56 w-auto max-w-full object-contain"
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                <span className="truncate text-caption text-ink-soft">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="edit"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("fFileChange")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`grid place-items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-150 hover:bg-sunken ${
                errors.file ? "border-danger" : "border-line-strong"
              }`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink">
                <Icon name="plus" className="ic h-5 w-5" />
              </span>
              <span className="text-body-strong font-bold text-ink">{t("fFileChoose")}</span>
              <span className="text-caption text-ink-faint">{t("fFileHint")}</span>
            </button>
          )}

          {errors.file && (
            <p className="text-caption font-semibold text-danger">{errors.file}</p>
          )}
        </div>

        <Input
          label={t("fTitle")}
          placeholder={t("fTitlePh")}
          value={title}
          error={errors.title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((prev) => ({ ...prev, title: undefined }));
          }}
        />

        <Input
          label={t("fAlbumOptional")}
          placeholder={t("fAlbumPh")}
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
        />
      </form>
    </Sheet>
  );
}
