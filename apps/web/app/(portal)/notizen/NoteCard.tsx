"use client";

import { useT, useLocale } from "@/lib/i18n";
import { relativeDays } from "@/lib/format";
import type { Note } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { notesDict } from "./i18n";

/**
 * Einzelne Notiz-Karte: Titel, Text-Vorschau (Zeilenumbrüche erhalten,
 * auf wenige Zeilen begrenzt) und Meta-Zeile mit Aktualisierungsdatum.
 * Aktionen „Bearbeiten“ und „Löschen“ öffnen die jeweiligen Dialoge im
 * Elternteil — gelöscht wird nie ohne ausdrückliche Bestätigung.
 */
export function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(notesDict);
  const { locale } = useLocale();

  const body = note.body.trim();

  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card">
      <h3 className="font-display text-h3 tracking-[-0.01em] text-ink">{note.title}</h3>

      {body ? (
        <p className="mt-2 whitespace-pre-line text-body leading-[22px] text-ink-soft line-clamp-6">
          {body}
        </p>
      ) : (
        <p className="mt-2 text-body italic text-ink-faint">{t("noBody")}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
        <span className="text-caption text-ink-faint">
          {t("updatedAt", { when: relativeDays(note.updatedAt, locale) })}
        </span>
        <div
          role="group"
          aria-label={t("cardActions", { title: note.title })}
          className="ml-auto flex flex-none items-center gap-2"
        >
          <Button
            variant="ghost"
            size="sm"
            icon="edit"
            aria-label={`${t("actEdit")} — ${note.title}`}
            onClick={onEdit}
          >
            {t("actEdit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${t("actDelete")} — ${note.title}`}
            className="text-danger hover:bg-danger/10 hover:text-danger"
            onClick={onDelete}
          >
            {t("actDelete")}
          </Button>
        </div>
      </div>
    </article>
  );
}
