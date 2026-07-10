/**
 * Dev-Auth-Storage — NUR ENTWICKLUNG.
 *
 * Token + Persona des Dev-Logins liegen unter localStorage["rsm.dev.auth"].
 * Externer Store im Stil von lib/i18n: Module ohne React, konsumierbar über
 * useSyncExternalStore (lib/auth/index.tsx) UND direkt vom API-Client
 * (getAccessToken). Auf dem Server gibt es nie eine Session.
 */

export const AUTH_STORAGE_KEY = "rsm.dev.auth";

/** Persona-Schlüssel wie in services/api/src/routes/dev-login.ts (DEV_PERSONAS). */
export type DevPersonaKey =
  | "coach"
  | "owner"
  | "treasurer"
  | "admin"
  | "moderator"
  | "member"
  | "guest"
  | "platform";

export type DevClubRole =
  | "owner"
  | "admin"
  | "moderator"
  | "treasurer"
  | "coach"
  | "member"
  | "guest_coach";

/** Profil aus der /dev/login-Antwort (Wire-Format, snake_case). */
export interface AuthProfile {
  sub: string;
  /** null für die Plattform-Persona (keine club_members-Zeile). */
  member_id: string | null;
  display_name: string;
  email: string;
  /** null für die Plattform-Persona (keine Vereinszugehörigkeit). */
  club_id: string | null;
  /** null für die Plattform-Persona (reiner Plattform-Admin ohne Club-Rolle). */
  club_role: DevClubRole | null;
  /**
   * Spiegelung des Token-Claims app_metadata.is_platform_admin. Nur die
   * Plattform-Persona setzt das; steuert allein die Sichtbarkeit des
   * Plattform-Menüs (die Durchsetzung ist serverseitig, requirePlatformAdmin).
   */
  is_platform_admin?: boolean;
}

export interface AuthSession {
  persona: DevPersonaKey;
  token: string;
  /** Unix-Millisekunden, ab denen der Token abgelaufen ist. */
  expiresAt: number;
  profile: AuthProfile;
}

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  // Cross-Tab-Sync: Login/Logout in einem anderen Tab spiegeln.
  const onStorage = (e: StorageEvent) => {
    if (e.key === AUTH_STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/* Snapshot-Cache: getSnapshot muss referenzstabil sein (useSyncExternalStore). */
let cachedRaw: string | null | undefined;
let cachedSession: AuthSession | null = null;

function parseSession(raw: string): AuthSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.persona !== "string" ||
      typeof parsed.profile !== "object" ||
      parsed.profile === null
    ) {
      return null;
    }
    // Abgelaufene Tokens zählen als „nicht angemeldet".
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

/** Aktuelle Dev-Session oder null — serverseitig immer null. */
export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = raw === null ? null : parseSession(raw);
  }
  return cachedSession;
}

export function writeSession(session: AuthSession): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  cachedRaw = undefined; // Cache invalidieren
  emit();
}

export function clearSession(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  cachedRaw = undefined;
  emit();
}
