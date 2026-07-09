"use client";

import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Icon } from "@/components/shell/icons";

/**
 * Formular-Set (DESIGN-SYSTEM §3.4): Inputs auf Sunken, radius-m 12,
 * min-height 44, Placeholder ink-faint. Fehler in Klartext UNTER dem
 * Feld (danger) — nie nur ein roter Rand.
 */

type FieldChrome = {
  label: string;
  /** Hilfetext unter dem Feld */
  hint?: string;
  /** Fehlertext in Klartext — aktiviert den Fehlerzustand */
  error?: string;
  className?: string;
};

const CONTROL_CLASS =
  "w-full rounded-md border bg-sunken px-4 text-body text-ink placeholder:text-ink-faint transition-colors duration-150";

function borderClass(error?: string): string {
  return error ? "border-danger" : "border-transparent";
}

function FieldShell({
  id,
  label,
  hint,
  error,
  hintId,
  errorId,
  className = "",
  children,
}: FieldChrome & { id: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className={`grid gap-1.5 ${className}`.trim()}>
      <label htmlFor={id} className="text-[13px] font-bold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-caption font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-caption text-ink-faint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function useFieldIds(explicitId?: string) {
  const autoId = useId();
  const id = explicitId ?? autoId;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

function describedBy(error?: string, hint?: string, ids?: { hintId: string; errorId: string }) {
  if (error) return ids?.errorId;
  if (hint) return ids?.hintId;
  return undefined;
}

export function Input({
  label,
  hint,
  error,
  className,
  id: explicitId,
  ...rest
}: FieldChrome & Omit<ComponentPropsWithoutRef<"input">, "className">) {
  const ids = useFieldIds(explicitId);
  return (
    <FieldShell {...ids} label={label} hint={hint} error={error} className={className}>
      <input
        id={ids.id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, hint, ids)}
        className={`${CONTROL_CLASS} min-h-11 ${borderClass(error)}`}
        {...rest}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  id: explicitId,
  children,
  ...rest
}: FieldChrome & Omit<ComponentPropsWithoutRef<"select">, "className">) {
  const ids = useFieldIds(explicitId);
  return (
    <FieldShell {...ids} label={label} hint={hint} error={error} className={className}>
      <span className="relative block">
        <select
          id={ids.id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(error, hint, ids)}
          className={`${CONTROL_CLASS} min-h-11 appearance-none pr-10 ${borderClass(error)}`}
          {...rest}
        >
          {children}
        </select>
        <Icon
          name="chevronDown"
          className="ic pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        />
      </span>
    </FieldShell>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  id: explicitId,
  ...rest
}: FieldChrome & Omit<ComponentPropsWithoutRef<"textarea">, "className">) {
  const ids = useFieldIds(explicitId);
  return (
    <FieldShell {...ids} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={ids.id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, hint, ids)}
        className={`${CONTROL_CLASS} min-h-24 py-3 leading-[22px] ${borderClass(error)}`}
        {...rest}
      />
    </FieldShell>
  );
}
