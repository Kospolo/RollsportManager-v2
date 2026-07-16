"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { API_BASE_URL, DATA_SOURCE } from "@/lib/data/config";
import {
  clearSession,
  readSession,
  setSessionClub,
  subscribeAuth,
  writeSession,
  type AuthProfile,
  type AuthSession,
  type DevPersonaKey,
} from "./storage";

/**
 * Dev-Auth des Portals — NUR ENTWICKLUNG (api-Modus, lokaler Dev-Stack).
 *
 * AuthProvider + useAuth() spiegeln die localStorage-Session (rsm.dev.auth).
 * signIn(persona) ruft POST {API}/dev/login auf und speichert Token+Profil;
 * signOut() löscht die Session. Im mock-Modus wird der Status ignoriert —
 * AuthGate lässt dort immer durch und die Shell fällt auf die Demo-Persona
 * (Sandra Vogel) zurück.
 */

export type { AuthProfile, AuthSession, DevPersonaKey };
export { DEV_PERSONA_CARDS, personaByKey, ROLE_LABELS, type DevPersonaCard } from "./personas";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

/** Der Dev-Stack antwortet nicht → Klartext-Hinweis auf scripts/dev-stack.sh up. */
export class DevStackDownError extends Error {
  readonly code = "dev_stack_down" as const;
  constructor() {
    super(`Dev-API unter ${API_BASE_URL} nicht erreichbar`);
    this.name = "DevStackDownError";
  }
}

interface DevLoginResponse {
  token_type: "Bearer";
  access_token: string;
  expires_in: number;
  persona: DevPersonaKey;
  profile: AuthProfile;
}

/** POST /dev/login — wirft DevStackDownError, wenn der Stack nicht läuft. */
export async function devLogin(persona: DevPersonaKey): Promise<AuthSession> {
  if (DATA_SOURCE !== "api") {
    throw new Error("devLogin ist nur im api-Modus (NEXT_PUBLIC_DATA_SOURCE=api) erlaubt");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/dev/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ persona }),
    });
  } catch {
    throw new DevStackDownError();
  }
  if (!res.ok) {
    throw new Error(`Dev-Login fehlgeschlagen (HTTP ${res.status})`);
  }
  const body = (await res.json()) as DevLoginResponse;
  const session: AuthSession = {
    persona: body.persona,
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    profile: body.profile,
  };
  writeSession(session);
  return session;
}

type AuthContextValue = {
  /** "loading" nur vor der Hydration — danach anonymous/authenticated. */
  status: AuthStatus;
  session: AuthSession | null;
  signIn: (persona: DevPersonaKey) => Promise<AuthSession>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/* Server-Snapshot "loading": SSR kennt localStorage nicht; nach der
   Hydration liefert der Client-Snapshot sofort die echte Session. */
const LOADING = Symbol("loading");

function getServerSnapshot(): typeof LOADING {
  return LOADING;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore<AuthSession | null | typeof LOADING>(
    subscribeAuth,
    readSession,
    getServerSnapshot,
  );

  const session = snapshot === LOADING ? null : snapshot;
  const status: AuthStatus =
    snapshot === LOADING ? "loading" : session ? "authenticated" : "anonymous";

  const signIn = useCallback((persona: DevPersonaKey) => devLogin(persona), []);
  const signOut = useCallback(() => clearSession(), []);

  const value = useMemo(
    () => ({ status, session, signIn, signOut }),
    [status, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}

/**
 * Re-Export: die Registrierung merkt sich nach der Vereinsanlage, welchen
 * Verein das Portal anzeigen soll (siehe storage.setSessionClub — kein
 * Rechte-Trick, die Rechte kommen aus der DB).
 */
export { setSessionClub };
