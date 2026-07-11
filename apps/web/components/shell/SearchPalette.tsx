"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT, type Dict } from "@/lib/i18n";
import {
  searchAll,
  type SearchResult,
  type SearchResultKind,
  type SearchResults,
} from "@/lib/search";
import { Icon, type IconName } from "./icons";

/**
 * Befehls-/Suchpalette der Topbar (⌘K). Öffnet als Overlay über der Shell,
 * fächert live über den lib/search-Aggregator (Mitglieder, Termine, Küren,
 * Neuigkeiten) und navigiert per Tastatur oder Klick zum Ziel. KEIN eigener
 * Endpoint — die RLS scoped die Facade-Reads bereits.
 *
 * Steuerung: Pfeiltasten wählen, ↵ öffnet, Esc schließt. Umlaute strikt,
 * beide Sprachen.
 */

const dict = {
  de: {
    label: "Suche",
    placeholder: "Mitglieder, Termine, Küren, Neuigkeiten …",
    close: "Schließen",
    idle: "Tippe, um Mitglieder, Termine, Küren und Neuigkeiten zu durchsuchen.",
    searching: "Suche läuft …",
    emptyTitle: "Keine Treffer",
    emptyBody: "Für „{query}“ wurde nichts gefunden.",
    kindMember: "Mitglieder",
    kindEvent: "Termine",
    kindRoutine: "Küren",
    kindNews: "Neuigkeiten",
    hintNavigate: "wählen",
    hintOpen: "öffnen",
    hintClose: "schließen",
  },
  en: {
    label: "Search",
    placeholder: "Members, events, routines, news …",
    close: "Close",
    idle: "Type to search members, events, routines and news.",
    searching: "Searching …",
    emptyTitle: "No matches",
    emptyBody: "Nothing found for “{query}”.",
    kindMember: "Members",
    kindEvent: "Events",
    kindRoutine: "Routines",
    kindNews: "News",
    hintNavigate: "select",
    hintOpen: "open",
    hintClose: "close",
  },
} satisfies Dict;

const KIND_ORDER: SearchResultKind[] = ["member", "event", "routine", "news"];

const KIND_ICON: Record<SearchResultKind, IconName> = {
  member: "members",
  event: "events",
  routine: "routines",
  news: "sparkle",
};

const KIND_LABEL_KEY: Record<SearchResultKind, keyof (typeof dict)["de"]> = {
  member: "kindMember",
  event: "kindEvent",
  routine: "kindRoutine",
  news: "kindNews",
};

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(dict);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const flat = results?.results ?? [];

  // Beim Öffnen fokussieren + Body-Scroll sperren; beim Schließen zurücksetzen.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
      setLoading(false);
      return;
    }
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Debounced Live-Suche über den Aggregator. Stale-Ergebnisse werden verworfen.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length === 0) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const res = await searchAll(q);
        if (!cancelled) {
          setResults(res);
          setActiveIndex(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 130);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, open]);

  // Aktive Zeile in den sichtbaren Bereich rollen.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({ kind, items: results?.byKind[kind] ?? [] })).filter(
        (g) => g.items.length > 0,
      ),
    [results],
  );

  if (!open) return null;

  function select(result: SearchResult) {
    onClose();
    router.push(result.href);
  }

  function move(delta: number) {
    if (flat.length === 0) return;
    setActiveIndex((current) => (current + delta + flat.length) % flat.length);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = flat[activeIndex];
      if (result) select(result);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const trimmed = query.trim();
  const showEmpty = trimmed.length > 0 && !loading && flat.length === 0;
  const showIdle = trimmed.length === 0;

  // Laufender Zähler, damit Klick/Tastatur denselben globalen Index teilen.
  let cursor = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-ink/35 px-4 pb-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("label")}
        className="flex h-fit w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        onKeyDown={onKeyDown}
      >
        {/* Eingabezeile */}
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Icon name="search" className="ic h-[18px] w-[18px] flex-none text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-label={t("label")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("placeholder")}
            className="min-h-[52px] w-full flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-ink-faint transition-colors duration-150 hover:bg-sunken hover:text-ink-soft"
          >
            <Icon name="close" className="ic h-4 w-4" />
          </button>
        </div>

        {/* Ergebnisliste / Zustände */}
        <div
          ref={listRef}
          id="search-results"
          role="listbox"
          aria-label={t("label")}
          className="max-h-[min(60vh,440px)] overflow-y-auto p-1.5"
        >
          {showIdle && (
            <p className="px-3 py-6 text-center text-[13.5px] text-ink-faint">{t("idle")}</p>
          )}

          {!showIdle && showEmpty && (
            <div className="px-3 py-8 text-center">
              <b className="block text-body-strong text-ink">{t("emptyTitle")}</b>
              <span className="mt-1 block text-[13px] text-ink-faint">
                {t("emptyBody", { query: trimmed })}
              </span>
            </div>
          )}

          {!showIdle && loading && flat.length === 0 && (
            <p className="px-3 py-6 text-center text-[13.5px] text-ink-faint">{t("searching")}</p>
          )}

          {groups.map((group) => (
            <section key={group.kind} className="mb-1 last:mb-0">
              <div className="eyebrow px-3 pb-1 pt-2">{t(KIND_LABEL_KEY[group.kind])}</div>
              {group.items.map((item) => {
                const index = cursor++;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={`${item.kind}:${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-index={index}
                    onClick={() => select(item)}
                    onMouseMove={() => setActiveIndex(index)}
                    className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left transition-colors duration-100 ${
                      isActive ? "bg-sunken" : "hover:bg-sunken"
                    }`}
                  >
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-brand-soft text-brand-ink">
                      <Icon name={KIND_ICON[item.kind]} className="ic h-[17px] w-[17px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold text-ink">
                        {item.title}
                      </b>
                      {item.subtitle && (
                        <span className="block truncate text-[12px] text-ink-faint">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <Icon
                        name="chevronRight"
                        className="ic h-4 w-4 flex-none text-ink-faint"
                      />
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </div>

        {/* Tastatur-Hinweise */}
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {t("hintNavigate")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>↵</kbd>
            {t("hintOpen")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd>esc</kbd>
            {t("hintClose")}
          </span>
        </div>
      </div>
    </div>
  );
}
