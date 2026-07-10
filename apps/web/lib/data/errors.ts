import { ApiError } from "@/lib/api/generated";

/**
 * Fehlermodell der Daten-Facade.
 *
 * - NotImplementedError: der Endpoint existiert (noch) nicht in der API —
 *   Screens fangen das ab und zeigen einen leeren Zustand mit Hinweis
 *   (EmptyState), sie crashen NIE deswegen.
 * - ApiError (re-exportiert aus dem generierten Client): echte API-Fehler
 *   als RFC 7807 problem+json (401/403/404/409/422) inkl. request_id.
 */

export { ApiError };

export class NotImplementedError extends Error {
  readonly code = "not_implemented" as const;
  /** Menschlich lesbarer Feature-Name, z. B. "Kassenbuch" */
  readonly feature: string;

  constructor(feature: string) {
    super(`Not implemented in api mode: ${feature}`);
    this.name = "NotImplementedError";
    this.feature = feature;
  }
}

export function isNotImplemented(error: unknown): error is NotImplementedError {
  return error instanceof NotImplementedError;
}

/** 403? — für „Keine Berechtigung"-Toasts der Schreibpfade. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Beste verfügbare Klartext-Meldung eines Fehlers (Problem-detail → title →
 * message). Für Toasts; die Übersetzung der Standardfälle machen die Screens.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.problem?.title ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
