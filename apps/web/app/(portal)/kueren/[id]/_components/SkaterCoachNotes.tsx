"use client";

import { useState } from "react";
import type { Member } from "@/lib/types";
import type { MemberCoachNote } from "@/lib/api/generated";
import { fullName, memberById, permissions } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { CoachNotesCard } from "@/app/(portal)/mitglieder/[id]/ProfileSections";
import {
  CoachNoteSheet,
  type CoachNoteSheetValue,
} from "@/app/(portal)/mitglieder/[id]/CoachNoteSheet";
import { CoachNoteDeleteDialog } from "@/app/(portal)/mitglieder/[id]/CoachNoteDeleteDialog";
import { useCoachNotes } from "@/app/(portal)/mitglieder/[id]/useCoachNotes";
import { kuerenDict } from "../../i18n";

/**
 * Die INTERNE Trainer-Notiz (Migration 0069) im KUER-Kontext — fuer genau EINE:N
 * Laeufer:in dieser Kuer. Wiederverwendung OHNE Duplikat: exakt dieselben
 * Bausteine wie auf der Mitglied-Detailseite (CoachNotesCard + CoachNoteSheet +
 * CoachNoteDeleteDialog + useCoachNotes), nur hier im Kuer-Rahmen eingesetzt.
 *
 * ⚠️ NICHT die persoenliche „Meine Notiz" (NotesCard, localStorage) — die steht
 * unveraendert daneben. Diese Notiz sehen ausschliesslich Trainer:innen und der
 * Vorstand; Mitglied und Familie NIEMALS. Die Sichtbarkeit dieser Karte
 * entscheidet der Aufrufer (RoutineDetail: isTrainer || isClubAdmin); die
 * verbindliche Grenze zieht der Server (RLS) — ein 403 bleibt moeglich und wird
 * von den Sheets/Dialogen als ruhiger Toast behandelt.
 *
 * Als eigene Komponente je Skater, damit useCoachNotes/useState je Person EINEN
 * stabilen Aufruf haben (Rules of Hooks): der Aufrufer rendert sie in einer
 * gekeyten Liste, nicht in einer Schleife im selben Component-Body.
 */
export function SkaterCoachNotes({
  skater,
  members,
  currentUser,
  heading = null,
}: {
  skater: Member;
  /** Gesamte Roster-Liste — nur zum Aufloesen des Verfasser-Namens. */
  members: Member[];
  /** Betrachter:in (getCurrentUser) — bestimmt, wer aendern/loeschen darf. */
  currentUser: Member;
  /** Name der/des Laeufer:in — nur bei Paar-/Gruppenkueren gesetzt, sonst null. */
  heading?: string | null;
}) {
  const t = useT(kuerenDict);
  // Der Aufrufer rendert diese Komponente nur fuer Berechtigte, daher immer aktiv.
  const { notes, reload } = useCoachNotes(skater.id, true);
  // Ein Sheet fuer Anlegen UND Bearbeiten (der Pflicht-Hinweis muss in beiden
  // Faellen erscheinen); Loeschen hat einen eigenen Bestaetigungs-Dialog.
  const [noteSheet, setNoteSheet] = useState<CoachNoteSheetValue | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<MemberCoachNote | null>(null);

  const viewerId = currentUser.id;
  const viewerIsClubAdmin = permissions(currentUser).isClubAdmin;

  // Aendern/Loeschen ENGER als Lesen: „author or the board". Eine Trainerin
  // sieht die Notiz einer Kollegin, schreibt sie aber nicht um — sonst stuende
  // am Ende ein Satz unter fremdem Namen. Kosmetik; der Server erzwingt es.
  const mayModify = (note: MemberCoachNote) =>
    note.author_member_id === viewerId || viewerIsClubAdmin;

  // Verfasser-Name aus dem Roster (Fallback: generische Rolle „Trainer:in").
  const authorName = (mid: string): string => {
    const hit = memberById(members, mid);
    return hit ? fullName(hit) : t("coachNoteAuthorFallback");
  };

  // Solange nicht geladen (null): nichts bauen — kein leerer Kasten, keine
  // verwaiste Ueberschrift. Sobald geladen ([] oder Eintraege), erscheint sie.
  if (notes === null) return null;

  return (
    <div className="grid gap-2">
      {heading && (
        <p className="text-caption font-semibold text-ink-soft">{heading}</p>
      )}
      <CoachNotesCard
        notes={notes}
        authorName={authorName}
        canWrite
        canModify={mayModify}
        onWrite={() => setNoteSheet({ mode: "create" })}
        onEdit={(note) => setNoteSheet({ mode: "edit", note })}
        onDelete={setNoteToDelete}
      />
      {noteSheet && (
        <CoachNoteSheet
          // key: beim Wechsel zwischen „neu" und einer konkreten Notiz muss der
          // Entwurfstext frisch sein, sonst stuende der Text der zuletzt
          // bearbeiteten Notiz im naechsten Formular.
          key={noteSheet.mode === "edit" ? `note-${noteSheet.note.id}` : "note-new"}
          value={noteSheet}
          memberId={skater.id}
          onClose={() => setNoteSheet(null)}
          onSaved={() => void reload()}
        />
      )}
      <CoachNoteDeleteDialog
        note={noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onDeleted={() => void reload()}
      />
    </div>
  );
}
