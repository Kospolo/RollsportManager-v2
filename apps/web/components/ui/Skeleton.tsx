/**
 * Lade-Platzhalter (DESIGN-SYSTEM §3.10): ruhige, pulsierende Flächen in
 * Sunken-Ton — nie Spinner-Wald. Für Screens im api-Modus, während die
 * Facade lädt (siehe lib/data/MIGRATION.md).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-sunken ${className}`.trim()}
    />
  );
}

/** Mehrere Textzeilen — die letzte kürzer, wirkt wie echter Fließtext. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`grid gap-2 ${className}`.trim()}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
      ))}
    </span>
  );
}

/** Karten-Platzhalter in Surface-Optik — 1:1 anstelle einer Card rendern. */
export function SkeletonCard({ lines = 4, className = "" }: { lines?: number; className?: string }) {
  return (
    <section
      aria-hidden="true"
      className={`rounded-xl border border-line bg-surface p-5 shadow-card ${className}`.trim()}
    >
      <Skeleton className="mb-4 h-5 w-2/5" />
      <SkeletonText lines={lines} />
    </section>
  );
}
