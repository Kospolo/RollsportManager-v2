"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { CapabilityLevel, CapabilityResolution, ResolvedCapability } from "@/lib/data";
import { useData } from "@/lib/data/useData";

/**
 * Capability-Kontext: die aufgelösten Rechte der eingeloggten Person
 * (GET /me/capabilities), einmal geladen für die ganze Oberfläche.
 *
 * ### Das hier ist KOSMETIK. Bewusst. ###
 * Es blendet Knöpfe aus, damit niemand in einen 403 läuft. Es SCHÜTZT nichts.
 * Die Durchsetzung bleibt serverseitig (RLS + Trigger + requireCap) — wer diese
 * Datei umgeht, bekommt vom Server trotzdem eine 403. Genau deshalb darf ein
 * Ladefehler hier auch nicht „alles anzeigen" bedeuten: `capRank` liefert dann
 * 0 (fail-closed), und die Oberfläche zeigt weniger statt mehr.
 *
 * ### Warum aus der Datenbank und nicht aus dem Token ###
 * Die Rechte werden serverseitig live aufgelöst (app.cap_rank, 0025). Damit
 *   * wirken MEHRFACHROLLEN (der Claim trägt nur eine Rolle je Verein),
 *   * wirken Änderungen SOFORT, ohne Neu-Anmeldung.
 * Das ist der Kniff, auf dem die ganze Steuerzentrale steht: wer eine Stufe
 * ändert, ändert sie für alle, die gerade angemeldet sind — beim nächsten
 * Laden, ohne Token-Runde.
 *
 * ### Der Rang, nicht die Stufe ###
 * Für Vergleiche IMMER `rank` nehmen, nie rankOf(level). Beim Vereinsinhaber
 * fallen beide auseinander (protected-Kurzschluss, 0032): live gemessen bei 17
 * von 32 Fähigkeiten rank=5 bei level=read_all. Ein Client, der `level`
 * vergleicht, hielte den Inhaber für weniger berechtigt, als er ist.
 */

export const LEVEL_RANK: Readonly<Record<CapabilityLevel, number>> = {
  none: 0,
  read_own: 1,
  read_team: 2,
  read_all: 3,
  edit: 4,
  manage: 5,
};

export interface CapabilitiesValue {
  /** Die Auflösung, sobald geladen — sonst null. */
  resolution: CapabilityResolution | null;
  status: "loading" | "ready" | "error";
  /** Der durchgesetzte Rang (0..5) einer Fähigkeit. Unbekannt/Fehler → 0. */
  capRank: (key: string) => number;
  /** Erreicht die Person mindestens diese Stufe? Fail-closed. */
  hasCap: (key: string, minLevel: CapabilityLevel) => boolean;
  /** Der Katalog-Eintrag inkl. Labels/Skala/Etikett — oder undefined. */
  capability: (key: string) => ResolvedCapability | undefined;
  /** Trägt die Person die geschützte Inhaber-Rolle? (Für owner_only-Zeilen.) */
  isOwner: boolean;
  /** Neu laden — nach jeder Rechteänderung, damit die Oberfläche sofort nachzieht. */
  reload: () => void;
}

const CapabilitiesContext = createContext<CapabilitiesValue | null>(null);

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const state = useData((repo) => repo.getMyCapabilities(), []);
  const resolution = state.data ?? null;

  const byKey = useMemo(() => {
    const map = new Map<string, ResolvedCapability>();
    for (const c of resolution?.capabilities ?? []) map.set(c.key, c);
    return map;
  }, [resolution]);

  const capRank = useCallback((key: string) => byKey.get(key)?.rank ?? 0, [byKey]);
  const hasCap = useCallback(
    (key: string, minLevel: CapabilityLevel) => capRank(key) >= LEVEL_RANK[minLevel],
    [capRank],
  );
  const capability = useCallback((key: string) => byKey.get(key), [byKey]);

  // Die Inhaber-Rolle ist die GESCHÜTZTE Rolle. Der Server nennt sie nicht als
  // Flag, aber ihr Key ist stabil 'owner' (app.roles, 0023:111 — protected).
  // Zweite, unabhängige Anzeige: der protected-Kurzschluss macht cap_rank auf
  // JEDER Fähigkeit 5 (0025:232). Beides zusammen ist hier nur Anzeige — die
  // Wahrheit prüft app.is_club_owner serverseitig (0032).
  const isOwner = resolution?.roleKeys.includes("owner") ?? false;

  const value = useMemo<CapabilitiesValue>(
    () => ({
      resolution,
      status: state.status,
      capRank,
      hasCap,
      capability,
      isOwner,
      reload: state.reload,
    }),
    [resolution, state.status, state.reload, capRank, hasCap, capability, isOwner],
  );

  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>;
}

export function useCapabilities(): CapabilitiesValue {
  const ctx = useContext(CapabilitiesContext);
  if (!ctx) {
    throw new Error("useCapabilities muss innerhalb von <CapabilitiesProvider> verwendet werden");
  }
  return ctx;
}
