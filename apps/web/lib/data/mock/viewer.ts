import { memberStore } from "./member-store";
import type { Member } from "@/lib/types";

/**
 * Betrachter-Umschalter des MOCK-Modus (rein für Entwicklung/Demo).
 *
 * Standard-Persona ist memberStore[0] (Sandra Vogel, Trainerin). Für das
 * Durchspielen der SICHTBARKEITS-Staffelung — „was sieht der Vorstand, was ein
 * fremdes Mitglied, was ein Elternteil?" — lässt sich der Betrachter über
 * localStorage `rsm.mock.viewer` = <member-id> umstellen, ohne echte Auth.
 *
 * Nur der Mock liest das; der api-Modus kennt es nicht (dort trägt der echte
 * Login-Token die Identität). Fehlt/ungültig → Standard-Persona.
 */
export const MOCK_VIEWER_KEY = "rsm.mock.viewer";

export function mockViewer(): Member {
  if (typeof window !== "undefined") {
    try {
      const id = window.localStorage.getItem(MOCK_VIEWER_KEY);
      if (id) {
        const hit = memberStore.find((m) => m.id === id);
        if (hit) return hit;
      }
    } catch {
      /* localStorage nicht verfügbar → Standard-Persona */
    }
  }
  return memberStore[0];
}
