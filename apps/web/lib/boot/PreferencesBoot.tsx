"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { data, dataSource } from "@/lib/data";
import { LOCALE_STORAGE_KEY, useLocale } from "@/lib/i18n";
import { THEME_STORAGE_KEY, useTheme } from "@/lib/theme";

/**
 * Boot-Hydration der App-Shell: liest EINMAL nach dem Login die serverseitigen
 * Präferenzen (GET /me/preferences) und initialisiert damit Theme- und
 * Locale-Context, sodass ein neues Gerät das Konto-Setup übernimmt.
 *
 * NUR im api-Modus (im mock-Modus gibt es kein /me) und erst wenn die
 * Dev-Session authentifiziert ist. „Ohne Flash": Server-Werte werden nur
 * angewandt, wenn das Gerät noch KEINE eigene Wahl gespeichert hat — eine
 * bewusste lokale Umschaltung wird nie überschrieben und es entsteht kein
 * Hin-und-her-Umschalten. Das Inline-Theme-Script hat data-theme bereits vor
 * dem ersten Paint aus localStorage gesetzt.
 */
export function useBootPreferences(): void {
  const { status } = useAuth();
  const { setMode } = useTheme();
  const { setLocale } = useLocale();
  const done = useRef(false);

  useEffect(() => {
    if (dataSource !== "api") return; // mock hat kein /me
    if (status !== "authenticated") return; // erst nach erfolgreichem Login
    if (done.current) return;
    done.current = true;

    let active = true;
    data
      .getMyPreferences()
      .then((prefs) => {
        if (!active) return;
        // Nur übernehmen, wenn lokal noch nichts gewählt wurde → kein Override,
        // kein Flash-Loop gegen eine bewusste Umschaltung auf diesem Gerät.
        if (window.localStorage.getItem(THEME_STORAGE_KEY) == null) {
          setMode(prefs.theme);
        }
        if (window.localStorage.getItem(LOCALE_STORAGE_KEY) == null) {
          setLocale(prefs.locale === "en" ? "en" : "de");
        }
      })
      .catch(() => {
        // Präferenzen sind best-effort — bei Fehler bleibt der lokale Zustand.
        done.current = false;
      });

    return () => {
      active = false;
    };
  }, [status, setMode, setLocale]);
}

/**
 * Unsichtbarer Provider — rendert nichts, ruft nur useBootPreferences(). Muss
 * INNERHALB von ThemeProvider, I18nProvider und AuthProvider stehen.
 */
export function PreferencesBoot(): null {
  useBootPreferences();
  return null;
}
