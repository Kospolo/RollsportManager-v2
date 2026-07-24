"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import * as mock from "@/lib/mock";
import { DATA_SOURCE } from "@/lib/data/config";
import { MOCK_VIEWER_KEY } from "@/lib/data/mock/viewer";

/**
 * ES GIBT NUR EINEN SCHLÜSSEL: `rsm.mock.viewer` aus lib/data/mock/viewer.ts.
 *
 * Der Mock kannte den Betrachter-Wechsel schon — aber nur an EINER Stelle:
 * `mockViewer()` liest den Schlüssel bei jedem Aufruf frisch und versorgt
 * damit `repo.getCurrentUser()` und ein paar Module. Die rund 230 Stellen, die
 * `mock.currentUser` direkt lesen (Hülle, Menü, Gating), wussten davon nichts.
 * Deshalb konnte das Portal gleichzeitig „Katrin Grünewald" im Kürzel und
 * „Hallo, Sandra!" in der Begrüßung zeigen.
 *
 * Diese Grenze schließt die Lücke: Sie liest DENSELBEN Schlüssel und zieht
 * `mock.currentUser` nach. Wer einen zweiten Schlüssel einführt, baut den
 * Widerspruch wieder ein.
 */

/**
 * Wendet die unter /entwickler gewählte Demo-Person auf das Portal an.
 *
 * ### Warum das NICHT beim Laden des Moduls passiert ###
 * `next build` rendert alle Portal-Seiten STATISCH vor — das ausgelieferte
 * HTML zeigt immer die Vorgabe (Sandra Vogel). React vergleicht beim
 * Hydrieren seinen ersten Render mit genau diesem HTML. Würde die gespeicherte
 * Person schon beim Laden des Moduls gesetzt, zeigte der erste Render Jürgen,
 * das HTML aber Sandra: Hydration-Fehler, und im schlimmsten Fall wirft React
 * den ganzen Teilbaum weg.
 *
 * Deshalb die Reihenfolge: **erster Render = Vorgabe** (passt zum HTML),
 * danach im Effekt umschalten. Wer nichts gewählt hat — also jede normale
 * Besucherin — merkt davon nichts, weil dann gar nichts passiert.
 *
 * ### Warum ein Schlüssel und kein Zustand ###
 * Die ~230 Lesestellen holen sich `mock.currentUser` direkt, nicht aus einem
 * Context. Ein neuer Schlüssel wirft den Teilbaum weg und baut ihn neu auf —
 * dabei lesen alle erneut, und zwar die neue Person. Ein `Fragment` mit
 * Schlüssel tut das, ohne ein zusätzliches DOM-Element einzuziehen (ein
 * `<div>` an dieser Stelle würde das Layout der Shell zerlegen).
 *
 * Nur im mock-Modus aktiv. Im api-Modus kommt die Person aus dem Dev-Login.
 */
export function BetaViewerBoundary({ children }: { children: ReactNode }) {
  const [viewerKey, setViewerKey] = useState<string>("default");

  useEffect(() => {
    if (DATA_SOURCE !== "mock") return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(MOCK_VIEWER_KEY);
    } catch {
      // Privater Modus o. Ä. — dann bleibt es bei der Vorgabe.
      return;
    }
    if (!stored || stored === mock.currentUser.id) return;
    if (mock.setCurrentUser(stored)) setViewerKey(stored);
  }, []);

  return <Fragment key={viewerKey}>{children}</Fragment>;
}
