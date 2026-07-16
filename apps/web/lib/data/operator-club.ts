import { readSession, subscribeAuth } from "@/lib/auth/storage";

/**
 * DER VEREINS-UMSCHALTER der Betreiber-Ebene — „diesen Verein ansehen".
 *
 * ### Was hier passiert (und was ausdrücklich NICHT) ###
 * Gespeichert wird EIN Verein, den der Betreiber gerade ansieht. Mehr nicht.
 * Das ist eine reine ANZEIGE-Entscheidung: welchen club_id die Portal-Aufrufe
 * mitschicken (lib/data/api/client.ts → activeClubId). Es ist KEIN Rechte-Trick
 * und kann keiner sein — das Token bleibt Byte für Byte unverändert, und ob der
 * Zugriff erlaubt ist, entscheidet allein der Server:
 *
 *   * ein Plattform-Admin kommt in den fremden Verein hinein, weil die
 *     Audit-Middleware (services/api/src/middleware/operator-access.ts,
 *     Migration 0051) die Betreiber-Einsicht einschaltet UND dabei jeden
 *     Zugriff protokolliert — Einsicht und Nachweis hängen dort an derselben
 *     Zeile Code;
 *   * jede andere Person, die diesen localStorage-Eintrag von Hand setzt,
 *     bekommt vom Server 403 bzw. leere Listen. Genau wie heute schon bei
 *     setSessionClub (lib/auth/storage.ts).
 *
 * Trotzdem prüft readOperatorClub() den Plattform-Admin-Claim, bevor der
 * Eintrag überhaupt beachtet wird — fail-closed. Das schützt nicht die Daten
 * (das tut der Server), sondern die NUTZERIN: ohne diese Prüfung würde ein
 * Betreiber, der sich abmeldet und jemand anderes lässt sich am selben Rechner
 * anmelden, plötzlich mit einem fremden „aktiven Verein" dastehen und
 * unerklärliche 403 sehen. Der Claim wird bei jedem Lesen frisch geprüft,
 * deshalb braucht es auch keinen Eingriff in signOut().
 *
 * ### EHRLICHKEIT IST HIER PFLICHT, NICHT KÜR ###
 * Solange dieser Eintrag steht, MUSS die Oberfläche sichtbar sagen, dass gerade
 * als Betreiber in fremde Daten geschaut wird und dass das protokolliert wird
 * (components/shell/OperatorBanner.tsx, dauerhaftes Band — kein Toast, der
 * verschwindet). Ein Betreiber, der versehentlich glaubt, er sei „normal"
 * unterwegs, macht Fehler in den Daten von Kindern. Wer diesen Store benutzt,
 * ohne das Band zu zeigen, nimmt der Konstruktion ihren Sinn.
 */

export const OPERATOR_CLUB_STORAGE_KEY = "rsm.operator.club";

/** Der Verein, den der Betreiber gerade ansieht. Name/Kürzel nur zur Anzeige. */
export interface OperatorClub {
  id: string;
  name: string;
  shortName?: string;
}

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Abonnement für useSyncExternalStore. Hört auf BEIDE Quellen: den eigenen
 * Store (Umschalten im selben Tab) und die Auth-Session — meldet sich der
 * Betreiber ab, muss das Band sofort verschwinden, nicht erst beim nächsten
 * Rendern.
 */
export function subscribeOperatorClub(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeAuth = subscribeAuth(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === OPERATOR_CLUB_STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    unsubscribeAuth();
    window.removeEventListener("storage", onStorage);
  };
}

/* Snapshot-Cache: getSnapshot muss referenzstabil sein (useSyncExternalStore) —
   gleiches Muster wie lib/auth/storage.ts. */
let cachedRaw: string | null | undefined;
let cachedClub: OperatorClub | null = null;

function parse(raw: string): OperatorClub | null {
  try {
    const parsed = JSON.parse(raw) as Partial<OperatorClub>;
    if (typeof parsed.id !== "string" || parsed.id === "") return null;
    if (typeof parsed.name !== "string") return null;
    return {
      id: parsed.id,
      name: parsed.name,
      ...(typeof parsed.shortName === "string" ? { shortName: parsed.shortName } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Der aktuell angesehene Verein — oder null.
 *
 * Fail-closed: ohne Plattform-Admin-Claim in der Session wird der Eintrag
 * IGNORIERT (nicht gelöscht — Löschen wäre ein Schreibvorgang beim Lesen).
 * Serverseitig immer null (kein window).
 */
export function readOperatorClub(): OperatorClub | null {
  if (typeof window === "undefined") return null;
  if (readSession()?.profile.is_platform_admin !== true) return null;
  const raw = window.localStorage.getItem(OPERATOR_CLUB_STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedClub = raw === null ? null : parse(raw);
  }
  return cachedClub;
}

/** „Diesen Verein ansehen" — ab jetzt tragen die Portal-Aufrufe diesen club_id. */
export function setOperatorClub(club: OperatorClub): void {
  window.localStorage.setItem(OPERATOR_CLUB_STORAGE_KEY, JSON.stringify(club));
  cachedRaw = undefined; // Cache invalidieren
  emit();
}

/** „Einsicht beenden" — zurück auf die reine Betreiber-Ebene. */
export function clearOperatorClub(): void {
  window.localStorage.removeItem(OPERATOR_CLUB_STORAGE_KEY);
  cachedRaw = undefined;
  emit();
}
