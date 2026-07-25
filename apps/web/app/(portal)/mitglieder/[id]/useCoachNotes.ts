"use client";

import { useCallback, useEffect, useState } from "react";
import { data } from "@/lib/data";
import type { MemberCoachNote } from "@/lib/api/generated";

/**
 * Laedt die INTERNEN Trainer-Notizen (Migration 0069) ueber EINEN eigenen
 * Endpunkt — bewusst nicht ueber das Profil-Aggregat, das die Familie fuer ihr
 * Kind oeffnet. null = nicht geladen bzw. nicht erlaubt (die Karte wird dann gar
 * nicht gebaut).
 *
 * EIN Exemplar, zwei Nutzer: die Mitglied-Detailseite (MemberDetail) und der
 * Kuer-Kontext (SkaterCoachNotes) teilen sich dieselbe Lade-/Nachlade-Logik,
 * damit die beiden Ansichten nicht auseinanderlaufen.
 */
export function useCoachNotes(memberId: string, enabled: boolean) {
  const [fetched, setFetched] = useState<MemberCoachNote[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Abbruchmarke: beim Wechsel auf ein anderes Mitglied darf die Antwort der
    // ALTEN Anfrage nicht mehr in den Zustand der neuen Seite laufen — sonst
    // stuenden die internen Notizen des vorigen Kindes am neuen Profil.
    let cancelled = false;
    void (async () => {
      try {
        const rows = await data.listMemberCoachNotes(memberId);
        if (!cancelled) setFetched(rows);
      } catch {
        if (!cancelled) setFetched([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, memberId]);

  // Abgeleitet statt im Effekt zurueckgesetzt: wer nicht darf, sieht null,
  // ohne dass ein Effekt dafuer synchron Zustand schreiben muss.
  const notes = enabled ? fetched : null;

  // Nachladen nach dem Speichern. Ohne Abbruchmarke: dieser Aufruf haengt an
  // einer Nutzeraktion, nicht am Lebenszyklus der Seite.
  const reload = useCallback(async () => {
    try {
      setFetched(await data.listMemberCoachNotes(memberId));
    } catch {
      setFetched([]);
    }
  }, [memberId]);

  return { notes, reload };
}
