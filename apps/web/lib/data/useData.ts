"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { data } from "./index";
import type { DataRepository } from "./types";

/**
 * Standard-Lade-Hook für Screens (siehe MIGRATION.md):
 *
 *   const members = useData((repo) => repo.getMembers());
 *   if (members.status === "loading") return <Skeleton … />;
 *   if (members.status === "error")   return <EmptyState … />;  // isNotImplemented(members.error) prüfen
 *   … members.data …
 *
 * `deps` steuert das Neuladen (z. B. eine Detail-ID); `reload()` lädt manuell
 * neu (Toast-Aktion „Wiederholen"). Während eines Neuladens bleibt der letzte
 * Stand sichtbar (kein Flackern).
 */

export type DataState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: unknown };

const LOADING: { status: "loading" } = { status: "loading" };

export function useData<T>(
  load: (repo: DataRepository) => Promise<T>,
  deps: readonly unknown[] = [],
): DataState<T> & { reload: () => void } {
  const [slot, setSlot] = useState<{ token: number; state: DataState<T> }>({
    token: -1,
    state: LOADING,
  });
  const tokenRef = useRef(0);
  const [generation, setGeneration] = useState(0);

  const reload = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    const token = ++tokenRef.current;
    load(data)
      .then((result) => {
        setSlot((current) =>
          tokenRef.current === token
            ? { token, state: { status: "ready", data: result } }
            : current,
        );
      })
      .catch((error: unknown) => {
        setSlot((current) =>
          tokenRef.current === token ? { token, state: { status: "error", error } } : current,
        );
      });
    // `load` ist bewusst kein Dep (Inline-Lambda) — Neuladen steuern deps+reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, generation]);

  // Erste Ladung: bis das erste Ergebnis da ist → loading. Bei Neuladen bleibt
  // der letzte Stand stehen (slot behält den zuletzt aufgelösten Zustand).
  const state = slot.token === -1 ? LOADING : slot.state;

  return useMemo(() => ({ ...state, reload }), [state, reload]);
}
