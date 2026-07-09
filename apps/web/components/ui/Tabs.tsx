"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

/**
 * Segment-Tabs (Mockup .seg / .theme-switch): Pill-Gruppe auf Sunken,
 * aktives Segment Surface + Schatten. Vollständige Tastaturbedienung
 * (Pfeiltasten, Home/End), ARIA-Tab-Semantik.
 */

export type TabItem<V extends string> = {
  value: V;
  label: string;
  count?: number;
};

export function Tabs<V extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  className = "",
}: {
  tabs: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Zugängliche Beschriftung der Tab-Gruppe */
  label: string;
  /** Gemeinsame ID-Basis mit den TabPanels (aria-controls/labelledby) */
  idBase?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = tabs.findIndex((tab) => tab.value === value);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      event.preventDefault();
      onChange(tabs[next].value);
      refs.current[next]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`inline-flex gap-0.5 rounded-full border border-line bg-sunken p-1 ${className}`.trim()}
    >
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            id={idBase ? `${idBase}-tab-${tab.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${tab.value}` : undefined}
            onClick={() => onChange(tab.value)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors duration-150 ${
              active ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-[11.5px] font-extrabold text-ink-faint tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Zugehöriges Panel — mit derselben idBase wie die Tabs verdrahten. */
export function TabPanel<V extends string>({
  value,
  active,
  idBase,
  children,
  className = "",
}: {
  value: V;
  active: V;
  idBase?: string;
  children: ReactNode;
  className?: string;
}) {
  const isActive = value === active;
  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      tabIndex={0}
      id={idBase ? `${idBase}-panel-${value}` : undefined}
      aria-labelledby={idBase ? `${idBase}-tab-${value}` : undefined}
      className={className}
    >
      {isActive ? children : null}
    </div>
  );
}
