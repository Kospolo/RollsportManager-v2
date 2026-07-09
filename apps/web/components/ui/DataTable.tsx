import type { ReactNode } from "react";

/**
 * Tabelle der Seriositätszone (DESIGN-SYSTEM §3.3):
 * Eyebrow-Kopf, Hairline-Trennung, NIE Zebra, nie eingefärbte Zeilen.
 * Beträge: `mono: true` → JetBrains Mono, tabular-nums, rechtsbündig —
 * Werte vorher mit formatEUR(...) formatieren (echtes Minuszeichen).
 * Summen IMMER aus abgeleiteten Mock-Exporten, nie hart codieren.
 */

export type Column<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Geld/Nummern-Disziplin: Mono 13/600, tabular, rechtsbündig */
  mono?: boolean;
  /** Zelle der Summenzeile (rendert tfoot, sobald eine Spalte footer hat) */
  footer?: ReactNode;
  /** Zusätzliche Klassen für Body-Zellen dieser Spalte */
  cellClassName?: string;
};

function alignClass<T>(column: Column<T>): string {
  return column.align === "right" || column.mono ? "text-right" : "text-left";
}

const MONO_CLASS = "whitespace-nowrap font-mono text-mono-table tabular-nums";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  className = "",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Screenreader-Überschrift der Tabelle */
  caption: string;
  /** Anzeige, wenn keine Zeilen da sind (Leere Zustände immer mit Handlung) */
  empty?: ReactNode;
  className?: string;
}) {
  const hasFooter = columns.some((column) => column.footer !== undefined);

  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={`overflow-x-auto ${className}`.trim()}>
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`border-b border-line px-3 pb-2 pt-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-ink-faint ${alignClass(column)}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={hasFooter ? "" : "[&>tr:last-child>td]:border-b-0"}>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="h-14 transition-colors duration-150 hover:bg-sunken/60">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`border-b border-line px-3 py-3 align-middle text-[14px] text-ink ${alignClass(column)} ${
                    column.mono ? MONO_CLASS : ""
                  } ${column.cellClassName ?? ""}`.trim()}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasFooter && (
          <tfoot>
            <tr>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`px-3 pb-1 pt-3 text-[13px] font-bold text-ink-soft ${alignClass(column)} ${
                    column.mono ? MONO_CLASS : ""
                  }`.trim()}
                >
                  {column.footer}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
