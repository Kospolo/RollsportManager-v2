"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { chatDict } from "./i18n";

/**
 * Verfassen-Leiste des Threads: Textfeld, Anhang-Knopf (Bild) und Senden.
 * Bild-Ablauf = zweistufig (v2-Muster): erst data.uploadChatImage (POST
 * /media/upload) → Media-URL, dann onSend mit imageUrl (das Schema verlangt eine
 * gültige URL, body ist bei Bild optional). Der Entwurf wird beim Absenden sofort
 * geleert (optimistisch) und bei Fehlern wieder hergestellt. Die Vorschau nutzt
 * eine lokale Object-URL, die bei Entfernen/Erfolg/Unmount freigegeben wird.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

type PickedImage = { file: File; previewUrl: string; name: string };

export function ChatComposer({
  onSend,
}: {
  /** Sendet die Nachricht (optimistisch + Server); wirft bei Fehler → Entwurf bleibt. */
  onSend: (input: { body?: string; imageUrl?: string }) => Promise<void>;
}) {
  const t = useT(chatDict);
  const { showToast } = useToast();

  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object-URL der Vorschau beim Unmount (z. B. Kanalwechsel) freigeben. Der Ref
  // wird in einem Effekt (nicht im Render) gespiegelt und beim Unmount gelesen.
  const imageRef = useRef<PickedImage | null>(null);
  useEffect(() => {
    imageRef.current = image;
  }, [image]);
  useEffect(() => {
    return () => {
      if (imageRef.current) URL.revokeObjectURL(imageRef.current.previewUrl);
    };
  }, []);

  const clearImage = () => {
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Input zurücksetzen, damit dieselbe Datei erneut wählbar bleibt.
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("imageTypeError"), { tone: "danger" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast(t("imageTooLargeError"), { tone: "danger" });
      return;
    }
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file), name: file.name };
    });
  };

  const submit = async () => {
    const body = draft.trim();
    const picked = image;
    if ((!body && !picked) || busy) return;
    setBusy(true);

    // Stufe 1: Bild hochladen (falls vorhanden) → Media-URL für imageUrl.
    let imageUrl: string | undefined;
    if (picked) {
      try {
        imageUrl = await data.uploadChatImage(picked.file);
      } catch (caught) {
        showToast(errorMessage(caught) || t("imageUploadError"), { tone: "danger" });
        setBusy(false);
        return; // Entwurf + Bild bleiben erhalten
      }
    }

    // Optimistisch leeren; Vorschau-URL erst nach Erfolg/Fehler final behandeln.
    setDraft("");
    setImage(null);
    try {
      await onSend({ body: body || undefined, imageUrl });
      if (picked) URL.revokeObjectURL(picked.previewUrl);
    } catch {
      // onSend hat bereits einen Toast gezeigt — Entwurf + Bild wiederherstellen.
      setDraft(body);
      setImage(picked);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const canSend = (draft.trim().length > 0 || image !== null) && !busy;

  return (
    <div className="border-t border-line p-3">
      {image && (
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-sunken p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- lokale Object-URL */}
          <img
            src={image.previewUrl}
            alt={t("attachedImage")}
            className="h-14 w-14 flex-none rounded-md object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{image.name}</span>
          <button
            type="button"
            onClick={clearImage}
            aria-label={t("removeImage")}
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-surface hover:text-danger"
          >
            <Icon name="close" className="ic h-4 w-4" />
          </button>
        </div>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label={t("attach")}
          title={t("attach")}
          className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-sunken disabled:pointer-events-none disabled:opacity-45"
        >
          <Icon name="image" className="ic h-5 w-5" />
        </button>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          aria-label={t("inputLabel")}
          placeholder={t("inputPlaceholder")}
          className="max-h-32 min-h-11 w-full flex-1 resize-none rounded-md border border-transparent bg-sunken px-4 py-2.5 text-body leading-[22px] text-ink placeholder:text-ink-faint"
        />
        <Button type="submit" icon="mail" disabled={!canSend} className="flex-none">
          {t("send")}
        </Button>
      </form>
    </div>
  );
}
