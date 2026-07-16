import { ApiError } from "../errors";
import type { ClubModuleState, ModuleRepository } from "../inputs-clubmodules";
import { MODULE_CATALOG } from "./seed-clubmodules";

/** RFC-7807-Fehler wie ihn der Server schickt — gleiche Bauform wie modules-rbac.ts. */
function problem(status: number, title: string, detail: string): ApiError {
  return new ApiError(status, { type: "about:blank", title, status, detail }, detail);
}

/**
 * Mock-Implementierung des Modul-Schalters (Migration 0044).
 *
 * ### Warum das hier ERNST gemeint ist ###
 * lib/data/config.ts:16-17 zwingt JEDEN Production-Build auf 'mock'. Täte der
 * Mock nur so, wäre die Modul-Seite im Default-Modus genau das, was der Nutzer
 * hier schon zweimal zu Recht angeprangert hat: ein Formular, das nichts
 * speichert. Der Store unten ist deshalb echt — ein umgelegter Schalter bleibt
 * bis zum Reload umgelegt, und das „Mehr"-Raster reagiert sofort darauf.
 *
 * ### Was der Mock NICHT ist ###
 * Er setzt NICHTS durch. Er kennt keine RLS, keine restriktive Policy, kein
 * Entitlement. Im Mock verschwindet die Kachel — die Daten wären per API weiter
 * da, wenn es hier eine API gäbe. Die echte Durchsetzung ist der Server
 * (0044: restriktive RLS-Policies), nachgemessen in 99e_club_modules.sql.
 * Die Fehlerfälle des Servers werden NACHGEBILDET statt verschluckt:
 *   * Kernmodul abschalten -> 409 (wie der Trigger app.club_modules_guard)
 *   * unbekannter Schlüssel -> 404
 * Das 403 ohne Admin-Rolle bildet der Mock NICHT nach: er hat keinen Token und
 * keine Rollenauflösung. Die Oberfläche blendet den Schalter für Nicht-Admins
 * aus (Kosmetik) — durchgesetzt wird es serverseitig.
 */

/** Schalterstellungen dieser Session. Leer = alles an (wie 0044: fehlende Zeile = an). */
const switches = new Map<string, boolean>();

function stateOf(entry: (typeof MODULE_CATALOG)[number]): ClubModuleState {
  // Kernmodul: immer an — der Store kann es gar nicht erst umlegen (siehe unten).
  const enabled = entry.core ? true : (switches.get(entry.moduleKey) ?? true);
  return {
    ...entry,
    enabled,
    // Die Und-Kette aus 0044: eingeschaltet UND gekauft. Der Schalter hebelt
    // das PRO-Gate nicht aus — deshalb hier UND, nicht ODER.
    available: enabled && entry.proOk,
  };
}

export const moduleRepositoryClubModules: ModuleRepository = {
  async listClubModules(): Promise<ClubModuleState[]> {
    return MODULE_CATALOG.map(stateOf).sort((a, b) => a.sort - b.sort);
  },

  async setClubModuleEnabled(moduleKey: string, enabled: boolean): Promise<ClubModuleState> {
    const entry = MODULE_CATALOG.find((m) => m.moduleKey === moduleKey);
    if (!entry) {
      throw problem(404, "Not Found", `Unbekanntes Modul "${moduleKey}". / Unknown module "${moduleKey}".`);
    }

    // Der Kernmodul-Schutz — nachgebildet nach app.club_modules_guard() (0044).
    if (entry.core && !enabled) {
      throw problem(
        409,
        "Conflict",
        `Das Modul "${moduleKey}" ist ein Kernmodul und kann nicht abgeschaltet werden. ` +
          `Mitglieder, Finanzen (Aufbewahrungspflicht) und Verwaltung bleiben immer an. ` +
          `/ Module "${moduleKey}" is a core module and cannot be switched off. ` +
          `Members, finance (retention duty) and administration always stay on.`,
      );
    }

    switches.set(moduleKey, enabled);
    return stateOf(entry);
  },
};
