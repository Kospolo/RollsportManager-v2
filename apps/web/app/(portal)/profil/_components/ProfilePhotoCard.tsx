"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/shell/icons";
import { notifyAvatarChanged } from "@/components/shell/avatar-events";
import { useToast } from "@/components/ui/Toast";
import { ApiError, data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { MyProfileMembership } from "@/lib/types";
import { profilDict, type ProfilKey } from "../i18n";

/** Max. Bildgröße — Spiegel der serverseitigen 25-MB-Grenze von POST /me/photo. */
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/** Menschliche Meldung für die typischen Foto-Upload-Fehler (403/413/415). */
function photoErrorText(error: unknown, t: (k: ProfilKey) => string): string {
  if (isForbidden(error)) return t("photoNoPermission");
  if (error instanceof ApiError) {
    if (error.status === 413) return t("photoErrSize");
    if (error.status === 415) return t("photoErrType");
  }
  return errorMessage(error);
}

/**
 * Profilfoto-Karte des EIGENEN Profils: Bild wählen → lokale Vorschau → über die
 * Facade hochladen (uploadMyPhoto → multipart POST /me/photo, nur eigenes Profil,
 * serverseitig erzwungen). Nach Erfolg zeigt der Avatar (Kopf + Karte) das Foto
 * optimistisch (onUploaded reicht die zurückgegebene URL hoch und löst den
 * /me-Reload aus). Die erweiterte Avatar-Komponente rendert das Foto statt der
 * Initialen; ohne Foto bleibt der Initialen-Fallback.
 *
 * „Auswahl entfernen“ verwirft die noch nicht gespeicherte Vorschau. Ein bereits
 * gespeichertes Foto lässt sich über „Foto entfernen“ serverseitig löschen
 * (data.removeMyPhoto → DELETE /me/photo, nur eigene Mitgliedschaften, RLS-scoped)
 * — nach einer Bestätigung, danach greift der Initialen-Fallback (onRemoved). Vor
 * dem Upload prüfen wir clientseitig Typ (Bild) und Größe (25 MB); die verbindliche
 * Allowlist bleibt serverseitig.
 */
export function ProfilePhotoCard({
  membership,
  currentUrl,
  onUploaded,
  onRemoved,
}: {
  membership: MyProfileMembership;
  currentUrl: string | null;
  onUploaded: (avatarUrl: string) => void;
  onRemoved: () => void;
}) {
  const t = useT(profilDict);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Lokale Vorschau-URL beim Unmount / Wechsel freigeben (kein Memory-Leak).
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function pickFile(next: File | null) {
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (!next) {
      setFile(null);
      return;
    }
    if (!(next.type || "").startsWith("image/")) {
      setFile(null);
      setError(t("photoErrType"));
      return;
    }
    if (next.size > MAX_PHOTO_BYTES) {
      setFile(null);
      setError(t("photoErrSize"));
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  /** Noch nicht gespeicherte Auswahl/Vorschau verwerfen. */
  function clearSelection() {
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file || submitting) return;
    setSubmitting(true);
    try {
      const result = await data.uploadMyPhoto(file);
      showToast(t("photoSavedToast"), { tone: "success" });
      clearSelection();
      // Optimistisch anzeigen + /me im Screen neu laden (getMyProfile).
      onUploaded(result.avatarUrl);
      // Topbar-Benutzermenü (api-Modus) das neue Foto nachladen lassen.
      notifyAvatarChanged();
    } catch (uploadError) {
      showToast(photoErrorText(uploadError, t), {
        tone: "danger",
        actionLabel: t("loadErrorRetry"),
        onAction: () => void handleUpload(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  /** Gespeichertes Foto serverseitig entfernen (nach Bestätigung). */
  async function handleRemove() {
    if (removing) return;
    setRemoving(true);
    try {
      await data.removeMyPhoto();
      setConfirmRemove(false);
      showToast(t("photoRemovedToast"), { tone: "success" });
      // Sofort Initialen zeigen + /me neu laden; Topbar-Chip nachziehen.
      onRemoved();
      notifyAvatarChanged();
    } catch (removeError) {
      showToast(photoErrorText(removeError, t), {
        tone: "danger",
        actionLabel: t("loadErrorRetry"),
        onAction: () => void handleRemove(),
      });
    } finally {
      setRemoving(false);
    }
  }

  const shownUrl = previewUrl ?? currentUrl;
  const hasPhoto = Boolean(currentUrl);
  const stateLabel = previewUrl
    ? t("photoPreviewLabel")
    : hasPhoto
      ? t("photoHasLabel")
      : t("photoNoneLabel");

  return (
    <Card>
      <CardHeader eyebrow={t("photoEyebrow")} title={t("photoTitle")} />

      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          personId={membership.id}
          firstName={membership.firstName}
          lastName={membership.lastName}
          avatarUrl={shownUrl}
          size="l"
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-[14px] font-bold text-ink">{stateLabel}</p>
          <p className="text-caption text-ink-faint">{t("photoFormatHint")}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
      />

      {error && <p className="mt-3 text-caption font-semibold text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {file ? (
          <>
            <Button icon="check" onClick={handleUpload} disabled={submitting}>
              {submitting ? t("photoUploading") : t("photoUpload")}
            </Button>
            <Button variant="ghost" icon="trash" onClick={clearSelection} disabled={submitting}>
              {t("photoDiscard")}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              icon="edit"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || removing}
            >
              {hasPhoto ? t("photoChange") : t("photoChoose")}
            </Button>
            {hasPhoto && (
              <Button
                variant="ghost"
                icon="trash"
                onClick={() => setConfirmRemove(true)}
                disabled={submitting || removing}
              >
                {t("photoRemove")}
              </Button>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-sunken px-3 py-2.5">
        <Icon name="shield" className="ic mt-0.5 h-4 w-4 flex-none text-ink-faint" />
        <p className="text-caption text-ink-soft">{t("photoPrivacy")}</p>
      </div>

      {confirmRemove && (
        <Modal
          open
          onClose={removing ? () => {} : () => setConfirmRemove(false)}
          eyebrow={t("photoRemoveEyebrow")}
          title={t("photoRemoveTitle")}
          maxWidthClass="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmRemove(false)} disabled={removing}>
                {t("photoRemoveCancel")}
              </Button>
              <Button variant="danger" icon="trash" onClick={handleRemove} disabled={removing}>
                {removing ? t("photoRemoving") : t("photoRemoveConfirm")}
              </Button>
            </>
          }
        >
          <p className="text-body text-ink-soft">{t("photoRemoveBody")}</p>
        </Modal>
      )}
    </Card>
  );
}
