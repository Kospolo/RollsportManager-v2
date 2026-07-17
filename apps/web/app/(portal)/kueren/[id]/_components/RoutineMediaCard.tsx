"use client";

import { useEffect, useRef, useState } from "react";
import type { Routine } from "@/lib/types";
import {
  ApiError,
  ClubProRequiredError,
  data,
  errorMessage,
  isForbidden,
} from "@/lib/data";
import { useT } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { kuerenDict, type KuerenKey } from "../../i18n";

/** Spiegel der serverseitigen 25-MB-Grenze von POST /routines/{id}/audio|image. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Löst eine auth-/RLS-gated Media-URL ('/media/{key}') über die Facade zu einer
 * nutzbaren Object-URL auf (Bearer-Token nötig; ein nacktes <img>/<audio> kann
 * ihn nicht mitschicken). data:/blob:/leer bleiben unverändert. Gibt die Bytes
 * beim Wechsel/Unmount wieder frei (kein Leak). Muster wie components/ui/Avatar.
 */
function useAuthedMedia(url: string | null): string | null {
  const marker = "/media/";
  // Direkt nutzbar (data:/blob:/fremd) ohne Auth-Fetch -> unverändert anzeigen.
  const isDirect =
    url != null && (url.startsWith("data:") || url.startsWith("blob:") || !url.includes(marker));
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (url == null || isDirect) return; // nichts zu laden, kein setState im Effektkörper
    const at = url.indexOf(marker);
    const key = decodeURIComponent(url.slice(at + marker.length));
    let active = true;
    let objectUrl: string | null = null;
    data
      .loadMediaUrl(key)
      .then((next) => {
        if (!active) {
          if (next.startsWith("blob:")) URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next.startsWith("blob:") ? next : null;
        setBlobUrl(next); // setState nur in der async-Callback (Regel-konform)
      })
      .catch(() => {
        if (active) setBlobUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, isDirect]);
  return isDirect ? url : blobUrl;
}

/**
 * Kür-Bild für ALLE Betrachter:innen der Kür (nicht nur Trainer:innen): löst die
 * auth-gated URL auf und zeigt das Bild; ohne Bild rendert es nichts.
 */
export function RoutineCoverImage({
  routine,
  className,
}: {
  routine: Routine;
  className?: string;
}) {
  const t = useT(kuerenDict);
  const src = useAuthedMedia(routine.imageUrl);
  if (!routine.imageUrl || !src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- auth-/RLS-gated Object-URL, kein Next-Loader.
    <img
      src={src}
      alt={t("imageAlt", { title: routine.title })}
      className={className ?? "max-h-72 w-full rounded-2xl border border-line bg-sunken object-cover"}
      decoding="async"
    />
  );
}

/** Menschliche, lokalisierte Meldung für die typischen Upload-Fehler. */
function mediaErrorText(
  error: unknown,
  t: (k: KuerenKey) => string,
  kind: "audio" | "image",
): string {
  if (error instanceof ClubProRequiredError) return t("mediaErrPro");
  if (isForbidden(error)) return t("mediaErrPermission");
  if (error instanceof ApiError) {
    if (error.status === 413) return t("mediaErrSize");
    if (error.status === 415) return kind === "audio" ? t("mediaErrTypeAudio") : t("mediaErrTypeImage");
    if (error.status === 402) return t("mediaErrPro");
  }
  return errorMessage(error) || t("mediaErrGeneric");
}

/**
 * Kür-Medien (nur Trainer:innen des Teams / Vorstand — im Aufrufer per
 * permissions().isTrainer ausgeblendet statt 403). Zwei Upload-Felder:
 * „Musik hochladen" (Audio) und „Bild hochladen" (Bild). Ablauf je Feld:
 * Datei wählen → data.attachRoutineAudio/-Image (EIN multipart-POST DIREKT an
 * /routines/{id}/audio|image, Server erzeugt den storage_key) → onChanged()
 * lädt die Kür neu, sodass Player-Metadaten bzw. Bild die neue Datei zeigen.
 * Typ/Größe werden vorab clientseitig geprüft; die verbindliche Allowlist bleibt
 * serverseitig.
 */
export function RoutineMediaCard({
  routine,
  onChanged,
}: {
  routine: Routine;
  onChanged: () => void;
}) {
  const t = useT(kuerenDict);
  const { showToast } = useToast();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  const audioSrc = useAuthedMedia(routine.audioUrl);
  const imageSrc = useAuthedMedia(routine.imageUrl);

  async function handleAudio(file: File | null) {
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (!file || audioBusy) return;
    if (!(file.type || "").startsWith("audio/")) {
      showToast(t("mediaErrTypeAudio"), { tone: "danger" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(t("mediaErrSize"), { tone: "danger" });
      return;
    }
    setAudioBusy(true);
    try {
      await data.attachRoutineAudio(routine.id, file);
      showToast(t("mediaAudioSaved"), { tone: "success" });
      onChanged();
    } catch (error) {
      showToast(mediaErrorText(error, t, "audio"), { tone: "danger" });
    } finally {
      setAudioBusy(false);
    }
  }

  async function handleImage(file: File | null) {
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (!file || imageBusy) return;
    if (!(file.type || "").startsWith("image/")) {
      showToast(t("mediaErrTypeImage"), { tone: "danger" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(t("mediaErrSize"), { tone: "danger" });
      return;
    }
    setImageBusy(true);
    try {
      await data.attachRoutineImage(routine.id, file);
      showToast(t("mediaImageSaved"), { tone: "success" });
      onChanged();
    } catch (error) {
      showToast(mediaErrorText(error, t, "image"), { tone: "danger" });
    } finally {
      setImageBusy(false);
    }
  }

  async function removeAudio() {
    if (audioBusy) return;
    setAudioBusy(true);
    try {
      await data.detachRoutineAudio(routine.id);
      showToast(t("mediaAudioRemoved"), { tone: "success" });
      onChanged();
    } catch (error) {
      showToast(mediaErrorText(error, t, "audio"), { tone: "danger" });
    } finally {
      setAudioBusy(false);
    }
  }

  async function removeImage() {
    if (imageBusy) return;
    setImageBusy(true);
    try {
      await data.detachRoutineImage(routine.id);
      showToast(t("mediaImageRemoved"), { tone: "success" });
      onChanged();
    } catch (error) {
      showToast(mediaErrorText(error, t, "image"), { tone: "danger" });
    } finally {
      setImageBusy(false);
    }
  }

  const hasAudio = Boolean(routine.audioUrl);
  const hasImage = Boolean(routine.imageUrl);

  return (
    <Card>
      <CardHeader eyebrow={t("mediaEyebrow")} title={t("mediaTitle")} />
      <p className="text-caption text-ink-soft">{t("mediaHint")}</p>

      {/* --- Musik ------------------------------------------------------- */}
      <section className="mt-5 grid gap-3">
        <div className="flex items-center gap-2">
          <Icon name="routines" className="ic h-4 w-4 flex-none text-ink-faint" />
          <h3 className="text-[14px] font-bold text-ink">{t("musicSectionTitle")}</h3>
          {hasAudio && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-caption font-semibold text-success">
              <Icon name="check" className="ic h-3.5 w-3.5" />
              {t("musicAttached")}
            </span>
          )}
        </div>

        {hasAudio && audioSrc ? (
          <audio controls src={audioSrc} className="w-full" preload="metadata">
            <track kind="captions" />
          </audio>
        ) : (
          <p className="text-caption text-ink-faint">{t("musicNone")}</p>
        )}

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="sr-only"
          onChange={(event) => void handleAudio(event.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => audioInputRef.current?.click()}
            disabled={audioBusy}
          >
            {audioBusy ? t("musicUploading") : hasAudio ? t("musicReplace") : t("musicUpload")}
          </Button>
          {hasAudio && (
            <Button variant="ghost" icon="trash" onClick={() => void removeAudio()} disabled={audioBusy}>
              {t("musicRemove")}
            </Button>
          )}
        </div>
      </section>

      {/* --- Bild -------------------------------------------------------- */}
      <section className="mt-6 grid gap-3 border-t border-line pt-5">
        <div className="flex items-center gap-2">
          <Icon name="image" className="ic h-4 w-4 flex-none text-ink-faint" />
          <h3 className="text-[14px] font-bold text-ink">{t("imageSectionTitle")}</h3>
        </div>

        {hasImage && imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- auth-/RLS-gated Object-URL, kein Next-Loader.
          <img
            src={imageSrc}
            alt={t("imageAlt", { title: routine.title })}
            className="max-h-56 w-full rounded-xl border border-line bg-sunken object-cover"
            decoding="async"
          />
        ) : (
          <p className="text-caption text-ink-faint">{t("imageNone")}</p>
        )}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleImage(event.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => imageInputRef.current?.click()}
            disabled={imageBusy}
          >
            {imageBusy ? t("imageUploading") : hasImage ? t("imageReplace") : t("imageUpload")}
          </Button>
          {hasImage && (
            <Button variant="ghost" icon="trash" onClick={() => void removeImage()} disabled={imageBusy}>
              {t("imageRemove")}
            </Button>
          )}
        </div>
      </section>
    </Card>
  );
}
