"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** UI-Sprachen: Deutsch (Default) und Englisch — immer beide vollständig gepflegt. */
export type Locale = "de" | "en";

export const LOCALES: Locale[] = ["de", "en"];
const STORAGE_KEY = "rsm.locale";

/* Externer Store über localStorage — SSR rendert Deutsch (Server-Snapshot),
   der Client übernimmt die gespeicherte Sprache ohne setState-im-Effect. */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "de" || stored === "en" ? stored : "de";
}

function getServerSnapshot(): Locale {
  return "de";
}

function persist(next: Locale) {
  window.localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next;
  emit();
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLocale = useCallback((next: Locale) => persist(next), []);
  const toggleLocale = useCallback(() => persist(getSnapshot() === "de" ? "en" : "de"), []);

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale }),
    [locale, setLocale, toggleLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale muss innerhalb von <I18nProvider> verwendet werden");
  return ctx;
}

/** Kolokalisiertes Dictionary: pro Screen/Komponente ein Objekt mit de+en. */
export type Dict<K extends string = string> = Record<Locale, Record<K, string>>;

/**
 * Hook für kolokalisierte Dictionaries.
 *
 *   const t = useT(dict);
 *   t("title")                     → String der aktiven Sprache
 *   t("greeting", { name: "Lea" }) → Platzhalter {name} wird ersetzt
 */
export function useT<K extends string>(dict: Dict<K>) {
  const { locale } = useLocale();
  return useCallback(
    (key: K, params?: Record<string, string | number>) => {
      let text = dict[locale][key] ?? dict.de[key] ?? key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [dict, locale],
  );
}
