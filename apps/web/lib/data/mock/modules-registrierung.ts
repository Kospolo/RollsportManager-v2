import { ApiError } from "../errors";
import type {
  JoinClubInput,
  JoinCodeState,
  JoinRequestResult,
  PendingJoinRequest,
  RegisterClubInput,
  RegisteredClub,
  RegistrierungRepository,
} from "../inputs-registrierung";

/**
 * Mock-Implementierung der Registrierung.
 *
 * ### Warum das hier ERNST gemeint ist ###
 * lib/data/config.ts:16-17 zwingt JEDEN Production-Build auf 'mock'. Ein
 * Formular, das im mock-Modus nur so tut, ist damit das, was JEDER sieht, der
 * die gebaute App oeffnet — und genau so entstehen tote Formulare, die
 * monatelang niemandem auffallen.
 *
 * Deshalb verhaelt sich der Mock wie der Server, INKLUSIVE der unbequemen
 * Teile:
 *   * Ein richtiger Code gibt "pending" zurueck, NICHT "drin". Wer hier
 *     schummelte, baute eine Oberflaeche, die im api-Modus sofort luegt.
 *   * Jeder falsche Code gibt DIESELBE Meldung — egal ob unbekannt,
 *     abgelaufen oder widerrufen (kein Enumerations-Orakel).
 *   * Die Normalisierung ist dieselbe Crockford-Regel wie in der DB
 *     (app.normalize_join_code): 0/O und 1/I/L sind dasselbe Zeichen.
 *
 * Der Zustand lebt im Modul (kein localStorage): ein Neuladen setzt die Demo
 * zurueck, und das ist gewollt — es ist eine Demo, kein zweites Backend.
 */

/** Crockford wie app.normalize_join_code (0034): [^0-9A-Za-z] weg, I/L->1, O->0. */
function normalizeCode(raw: string): string {
  return raw
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

/** Crockford-Alphabet ohne I/L/O/U — identisch zum Generator in 0034. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateCode(): string {
  // crypto.getRandomValues ist der CSPRNG des Browsers. Math.random waere hier
  // derselbe Fehler wie random() in v1 — in einer Demo folgenlos, aber es ist
  // die Stelle, an der jemand spaeter abschreibt.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const c = Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
  return `${c.slice(0, 4)}-${c.slice(4, 8)}`;
}

/** Der Demo-Verein aus dem Seed. Sein Code ist der, den die Demo einloest. */
const DEMO_CLUB = { id: "c1ab0000-0000-4000-8000-000000000001", name: "RSV Neckarsulm" };

const state: {
  joinCode: string;
  expiresAt: string | null;
  revokedAt: string | null;
  pending: PendingJoinRequest[];
} = {
  joinCode: "RSV-DEMO-2026",
  expiresAt: null,
  revokedAt: null,
  pending: [
    {
      memberId: "a0000000-0000-4000-8000-0000000000f1",
      firstName: "Nadja",
      lastName: "Neuling",
      requestedAt: new Date(Date.now() - 36e5 * 20).toISOString(),
    },
    {
      memberId: "a0000000-0000-4000-8000-0000000000f2",
      firstName: "Tobias",
      lastName: "Bär",
      requestedAt: new Date(Date.now() - 36e5 * 3).toISOString(),
    },
  ],
};

/** Dieselbe nichtssagende Absage wie der Server (registration.ts invalidCode). */
function invalidCode(): never {
  const detail = "Dieser Vereinscode ist nicht gültig. / This club code is not valid.";
  throw new ApiError(
    404,
    { type: "about:blank", title: "Not Found", status: 404, detail },
    detail,
  );
}

export const moduleRepositoryRegistrierung: RegistrierungRepository = {
  async registerClub(input: RegisterClubInput): Promise<RegisteredClub> {
    if (!input.acceptTerms || !input.acceptPrivacy) {
      throw new ApiError(400, { type: "about:blank", title: "Bad Request", status: 400 }, "Zustimmung fehlt. / Consent missing.");
    }
    const code = generateCode();
    return {
      clubId: `c1ab0000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`,
      clubName: input.name,
      joinCode: code,
      trialEndsAt: new Date(Date.now() + 30 * 864e5).toISOString(),
      ownerMemberId: "a0000000-0000-4000-8000-0000000000ff",
    };
  },

  async requestJoin(input: JoinClubInput): Promise<JoinRequestResult> {
    const wanted = normalizeCode(input.code);
    if (wanted === "") invalidCode();
    // Widerrufen/abgelaufen antworten IDENTISCH zu "gibt es nicht" — sonst
    // waere schon die Fehlermeldung die Auskunft, dass es den Code gibt.
    if (state.revokedAt !== null) invalidCode();
    if (state.expiresAt !== null && new Date(state.expiresAt).getTime() <= Date.now()) invalidCode();
    if (wanted !== normalizeCode(state.joinCode)) invalidCode();

    const memberId = `a0000000-0000-4000-8000-${Date.now().toString(16).slice(-12)}`;
    state.pending = [
      ...state.pending,
      {
        memberId,
        firstName: input.firstName,
        lastName: input.lastName,
        requestedAt: new Date().toISOString(),
      },
    ];
    return {
      clubId: DEMO_CLUB.id,
      clubName: DEMO_CLUB.name,
      memberId,
      // NIEMALS "active": ein Code ist ein Antrag, kein Zutritt.
      status: "pending",
    };
  },

  async getPendingJoinRequests(): Promise<PendingJoinRequest[]> {
    return [...state.pending];
  },

  async approveJoinRequest(memberId: string): Promise<void> {
    if (!state.pending.some((p) => p.memberId === memberId)) {
      throw new ApiError(404, { type: "about:blank", title: "Not Found", status: 404 }, "Kein offener Antrag. / No pending request.");
    }
    state.pending = state.pending.filter((p) => p.memberId !== memberId);
  },

  async rejectJoinRequest(memberId: string): Promise<void> {
    if (!state.pending.some((p) => p.memberId === memberId)) {
      throw new ApiError(404, { type: "about:blank", title: "Not Found", status: 404 }, "Kein offener Antrag. / No pending request.");
    }
    state.pending = state.pending.filter((p) => p.memberId !== memberId);
  },

  async getJoinCodeState(): Promise<JoinCodeState> {
    return {
      clubId: DEMO_CLUB.id,
      joinCode: state.joinCode,
      expiresAt: state.expiresAt,
      revokedAt: state.revokedAt,
    };
  },

  async rotateJoinCode(expiresInDays?: number | null): Promise<JoinCodeState> {
    state.joinCode = generateCode();
    state.revokedAt = null;
    state.expiresAt =
      expiresInDays === undefined || expiresInDays === null
        ? null
        : new Date(Date.now() + expiresInDays * 864e5).toISOString();
    return this.getJoinCodeState();
  },

  async revokeJoinCode(): Promise<JoinCodeState> {
    state.revokedAt = new Date().toISOString();
    return this.getJoinCodeState();
  },
};
