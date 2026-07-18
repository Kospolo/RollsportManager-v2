"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage, isClubModuleDisabled } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Note } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleNotBookedCard } from "@/components/ui/ModuleNotBookedCard";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { notesDict } from "./i18n";
import { NoteCard } from "./NoteCard";
import { NoteFormDialog, type NoteFormValue } from "./NoteFormDialog";
import { DeleteNoteDialog } from "./DeleteNoteDialog";

/**
 * Private Notizen des eingeloggten Nutzers: Liste, Anlegen, Bearbeiten und
 * Löschen — alle Pfade über die Facade (lib/data). Notizen sind STRIKT privat
 * (RLS: owner = auth.uid()); es gibt kein Trainer-Gate, deshalb kann jede:r
 * Nutzer:in nur die eigenen Notizen sehen und die Aktionen stehen immer offen.
 * Der Hinweis „nur für dich sichtbar“ macht das im UI unmissverständlich.
 */

const NO_NOTES: Note[] = [];

export function NotesClient() {
  const t = useT(notesDict);

  const state = useData((repo) => repo.listNotes());
  // Zuletzt geänderte zuerst — die eben erstellte/bearbeitete Notiz springt so
  // nach dem Neuladen verlässlich nach oben, unabhängig von der Datenquelle.
  const notes = useMemo(
    () =>
      [...(state.data ?? NO_NOTES)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.data],
  );

  const [form, setForm] = useState<NoteFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Note | null>(null);

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-5" aria-hidden="true">
        <Skeleton className="h-11 w-full max-w-xl rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  } else if (state.status === "error" && isClubModuleDisabled(state.error)) {
    // 403 club_module_disabled: der Verein hat "Notizen" nicht gebucht (0068).
    // Ehrlicher Zustand statt "konnten nicht geladen werden" — es ist nichts
    // kaputt, es ist nichts gebucht.
    body = (
      <ModuleNotBookedCard
        eyebrow={t("notBookedEyebrow")}
        title={t("notBookedTitle")}
        body={t("notBookedBody")}
        hint={t("notBookedHint")}
        badge={t("notBookedBadge")}
      />
    );
  } else if (state.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (notes.length === 0) {
    body = (
      <div className="grid gap-5">
        <PrivateBanner label={t("privateBanner")} />
        <EmptyState
          icon="edit"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("emptyCta")}
            </Button>
          }
        />
      </div>
    );
  } else {
    body = (
      <div className="grid gap-5">
        <PrivateBanner label={t("privateBanner")} />
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => setForm({ mode: "edit", note })}
              onDelete={() => setToDelete(note)}
            />
          ))}
        </div>
      </div>
    );
  }

  const countLabel = notes.length === 1 ? t("oneNote") : t("notesCount", { n: notes.length });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={state.status === "ready" && notes.length > 0 ? countLabel : t("sub")}
        action={
          <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
            {t("newNote")}
          </Button>
        }
      />

      {body}

      {form && (
        <NoteFormDialog
          key={form.mode === "edit" ? `edit-${form.note.id}` : "create"}
          value={form}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}
      <DeleteNoteDialog
        note={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}

/** Ruhiger Hinweis-Streifen: macht die Privatheit der Notizen deutlich. */
function PrivateBanner({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-ink-soft shadow-card">
      <Icon name="lock" className="ic h-4 w-4 flex-none text-ink-faint" />
      {label}
    </p>
  );
}
