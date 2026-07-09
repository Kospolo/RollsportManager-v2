"use client";

/**
 * Filter-Chips über Tabellen (DESIGN-SYSTEM §3.3, Jury-Übernahme aus A):
 * Pill-Chips, single-select, aktiver Chip brand-soft/brand-ink.
 * Filtern muss die Summenzeile im Tabellen-Footer aktualisieren —
 * das erledigt der aufrufende Screen über `onChange`.
 */

export type FilterChipOption<V extends string> = {
  value: V;
  label: string;
  /** Optionales Anzahl-Badge im Chip */
  count?: number;
};

export function FilterChips<V extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: FilterChipOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Zugängliche Gruppenbeschriftung, z. B. „Offene Posten filtern“ */
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors duration-150 ${
              active
                ? "border-transparent bg-brand-soft text-brand-ink"
                : "border-line-strong bg-surface text-ink-soft hover:bg-sunken"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-px text-[11.5px] font-extrabold tabular-nums ${
                  active ? "bg-brand text-brand-contrast" : "bg-sunken text-ink-soft"
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
