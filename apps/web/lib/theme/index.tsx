"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** Drei-Wege-Theme: Hell / Auto (folgt dem System) / Dunkel. */
export type ThemeMode = "light" | "auto" | "dark";

export const THEME_MODES: ThemeMode[] = ["light", "auto", "dark"];
export const THEME_STORAGE_KEY = "rsm.theme";

/* Kleiner externer Store über localStorage — SSR-sicher via
   useSyncExternalStore (Server-Snapshot "auto", kein setState-im-Effect). */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
}

function getServerSnapshot(): ThemeMode {
  return "auto";
}

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Das Inline-Script im Root-Layout hat data-theme bereits VOR dem
  // ersten Paint gesetzt (kein Flash); hier nur der React-Zustand dazu.
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback((next: ThemeMode) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    emit();
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme muss innerhalb von <ThemeProvider> verwendet werden");
  return ctx;
}
