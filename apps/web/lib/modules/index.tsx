"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { ClubModuleState } from "@/lib/data/inputs-clubmodules";
import { useData } from "@/lib/data/useData";

/**
 * Modul-Kontext: die Schalterstellung der Module des Vereins
 * (GET /clubs/{clubId}/modules -> app.club_module_states), einmal geladen fuer
 * die ganze Oberflaeche. Schwester von CapabilitiesProvider.
 *
 * ### KOSMETIK, bewusst. ###
 * Dieser Hook blendet Bereiche AUS, deren Modul der Verein abgeschaltet hat —
 * damit niemand in eine leere Seite oder einen 403 laeuft. Er SCHUETZT nichts:
 * die Durchsetzung sind die restriktiven RLS-Gates (0044/0061) und die
 * expliziten Service-Mode-Checks (lib/module-gate.ts). Wer diese Datei umgeht,
 * bekommt vom Server 0 Zeilen bzw. 403.
 *
 * ### FAIL-OPEN beim Laden — wie app.module_enabled ###
 * Solange die Liste laedt (oder nicht erreichbar ist), gilt jedes Modul als
 * verfuegbar: ein Ladefehler darf dem Verein nicht sein halbes Menue wegnehmen.
 * Ein unbekannter Schluessel = kein Schalter = sichtbar (fehlende Zeile = an).
 *
 * `available` ist die Und-Kette aus GEKAUFT (Entitlement/PRO) UND EINGESCHALTET
 * (Modul-Schalter) — genau das, was die Oberflaeche als „vorhanden" zeigen darf.
 * Die dritte Frage (ERLAUBT? = Faehigkeit) beantwortet useCapabilities.
 */
export interface ModulesValue {
  states: ClubModuleState[];
  status: "loading" | "ready" | "error";
  /** Ist das Modul fuer den Verein vorhanden (gekauft UND eingeschaltet)? Fail-open. */
  isModuleAvailable: (key: string) => boolean;
  /** Ist der Schalter eingeschaltet (unabhaengig vom PRO-Entitlement)? Fail-open. */
  isModuleEnabled: (key: string) => boolean;
  /**
   * Wird das Modul DIESER Person ueberhaupt angeboten? (0077)
   *
   * Die vierte Frage neben gekauft / eingeschaltet / erlaubt. `available` sagt
   * nur, ob der VEREIN das Modul hat — deshalb sah ein Mitglied im Menue
   * „Mehr" alle 26 Kacheln, auch Auswertung, Schliessfaecher, Jubilaeen,
   * Wartelisten, Gruppen und Finanzen.
   *
   * Quelle ist GET /clubs/{clubId}/modules/effective: eine FERTIG GEFILTERTE
   * Liste. Was darin fehlt, wird nicht angeboten. Deshalb muss „noch nicht
   * geladen" von „geladen, aber nicht dabei" unterschieden werden — sonst
   * kehrt sich die Bedeutung um und beim ersten Rendern verschwindet das halbe
   * Menue.
   */
  isModuleVisible: (key: string) => boolean;
  reload: () => void;
}

const ModulesContext = createContext<ModulesValue | null>(null);

export function ModulesProvider({ children }: { children: ReactNode }) {
  const state = useData((repo) => repo.listClubModules(), []);
  const states = useMemo(() => state.data ?? [], [state.data]);

  const byKey = useMemo(() => {
    const map = new Map<string, ClubModuleState>();
    for (const m of states) map.set(m.moduleKey, m);
    return map;
  }, [states]);

  // Fehlender/unbekannter Schluessel -> true (fail-open, wie app.module_enabled).
  const isModuleAvailable = useCallback((key: string) => byKey.get(key)?.available ?? true, [byKey]);
  const isModuleEnabled = useCallback((key: string) => byKey.get(key)?.enabled ?? true, [byKey]);

  // Zweite, PERSONENBEZOGENE Liste (0077) — siehe isModuleVisible oben.
  const effective = useData((repo) => repo.listEffectiveModules(), []);
  const visibleKeys = useMemo(
    () => new Set((effective.data ?? []).map((m) => m.moduleKey)),
    [effective.data],
  );
  const effectiveLoaded = effective.data != null;
  const isModuleVisible = useCallback(
    // Solange keine Antwort da ist: nichts ausblenden. Erst wenn eine da ist,
    // gilt sie — dann ist Fehlen eine Aussage, kein Ladezustand.
    (key: string) => !effectiveLoaded || visibleKeys.has(key),
    [effectiveLoaded, visibleKeys],
  );

  const value = useMemo<ModulesValue>(
    () => ({
      states,
      status: state.status,
      isModuleAvailable,
      isModuleEnabled,
      isModuleVisible,
      reload: state.reload,
    }),
    [states, state.status, state.reload, isModuleAvailable, isModuleEnabled, isModuleVisible],
  );

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules(): ModulesValue {
  const ctx = useContext(ModulesContext);
  if (!ctx) {
    throw new Error("useModules muss innerhalb von <ModulesProvider> verwendet werden");
  }
  return ctx;
}
