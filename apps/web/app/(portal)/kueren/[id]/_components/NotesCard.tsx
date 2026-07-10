"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { currentUser, fullName } from "@/lib/mock";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { kuerenDict } from "../../i18n";

/**
 * Trainingsnotizen zur Kür — rein lokal (localStorage), keine API.
 * localStorage wird als externer Store gelesen (useSyncExternalStore,
 * wie lib/i18n): SSR rendert leer, der Client übernimmt den Stand ohne
 * setState-im-Effect. Speichern bestätigt per Toast; Fehler nie still.
 */

type StoredNote = { text: string; savedAt: string };

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function parseNote(raw: string | null): StoredNote | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredNote;
  } catch {
    return null; // defekter Eintrag — leer starten
  }
}

export function NotesCard({ routineId }: { routineId: string }) {
  const t = useT(kuerenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const storageKey = `rsm.kueren.notes.${routineId}`;

  const storedRaw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey),
    () => null,
  );
  const stored = parseNote(storedRaw);

  /* null = noch nicht bearbeitet → gespeicherter Stand wird angezeigt. */
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? stored?.text ?? "";
  const dirty = text !== (stored?.text ?? "");

  const save = useCallback(
    function persist() {
      const value = draft ?? "";
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ text: value, savedAt: new Date().toISOString() } satisfies StoredNote),
        );
        emit();
        setDraft(null);
        showToast(t("noteSaved"), { tone: "success" });
      } catch {
        showToast(t("noteSaveError"), {
          tone: "danger",
          actionLabel: t("retry"),
          onAction: persist,
        });
      }
    },
    [draft, storageKey, showToast, t],
  );

  return (
    <Card>
      <CardHeader eyebrow={t("notesEyebrow")} title={t("notesTitle")} />
      <div className="grid gap-3">
        <Textarea
          label={t("notesLabel")}
          hint={t("notesHint")}
          placeholder={t("notesPlaceholder")}
          value={text}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon="check" onClick={save} disabled={!dirty}>
            {t("saveNote")}
          </Button>
          {stored?.savedAt && (
            <span className="ml-auto inline-flex items-center gap-2 text-caption text-ink-faint">
              <Avatar
                personId={currentUser.id}
                firstName={currentUser.firstName}
                lastName={currentUser.lastName}
                size="s"
              />
              {fullName(currentUser)} ·{" "}
              {t("lastSaved", { when: formatDateTime(stored.savedAt, locale) })}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
