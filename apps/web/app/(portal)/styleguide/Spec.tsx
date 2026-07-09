import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/**
 * Schaukasten für eine Komponente: Titel, Import-Pfad in Mono
 * und die Varianten darunter.
 */
export function Spec({
  title,
  importPath,
  children,
}: {
  title: string;
  importPath: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <header className="mb-4 grid gap-1">
        <h3 className="font-display text-h3 tracking-[-0.01em] text-ink">{title}</h3>
        <code className="font-mono text-[11.5px] text-ink-faint">{importPath}</code>
      </header>
      <div className="grid gap-4">{children}</div>
    </Card>
  );
}

/** Beschriftete Beispiel-Zeile innerhalb eines Schaukastens. */
export function SpecRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="eyebrow">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
