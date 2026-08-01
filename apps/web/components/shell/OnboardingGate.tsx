"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { dataSource } from "@/lib/data";
import { readSession, subscribeAuth } from "@/lib/auth/storage";
import { Onboarding } from "./onboarding/Onboarding";

/**
 * „KEIN VEREIN“-GATE der Portal-Shell (nur api-Modus).
 *
 * ### Was es abfaengt ###
 * Nach echter Anmeldung/Registrierung (E-Mail/Passwort) hat eine Person nicht
 * zwangslaeufig einen Verein: ein frisches Konto hat gar keinen, ein
 * Beitritts-Antrag ist noch nicht freigegeben. In diesen Faellen traegt das
 * Profil club_id = null. Oeffnete sie dann /dashboard, liefe das Portal ins
 * Leere („Keine Mitgliedschaft in diesem Verein“). Statt dessen zeigt dieses
 * Gate das Onboarding: Verein gruenden oder beitreten.
 *
 * ### Wen es NICHT betrifft ###
 * - Plattform-Admins (is_platform_admin) — die haben nie einen eigenen Verein
 *   und werden vom OperatorPortalGate mit der Vereins-Auswahl abgefangen.
 *   Deshalb gibt dieses Gate sie durch (Bedingung schliesst sie aus).
 * - Personen MIT aktivem Verein (club_id gesetzt) — normaler Portal-Betrieb.
 * - mock-Modus (Beta-Demo) — dort gibt es keine Session; das Gate ist inaktiv.
 *
 * Sitzt in der Shell zwischen AuthGate (angemeldet?) und OperatorPortalGate
 * (Betreiber ohne gewaehlten Verein). Reihenfolge zaehlt: erst angemeldet, dann
 * „hat die normale Person einen Verein?“, dann die Betreiber-Sonderfaelle.
 *
 * Sicherheit: reine ANZEIGE. Setzt die Person einen Verein (Gruenden ->
 * setSessionClub), re-rendert der Store und das Gate laesst durch. Die Rechte
 * kommen ohnehin aus der DB; wer hier trickst, bekommt vom Server 403.
 */

function needsOnboarding(): boolean {
  if (dataSource !== "api") return false;
  const session = readSession();
  if (session === null) return false; // anonym -> AuthGate
  if (session.profile.is_platform_admin === true) return false; // -> OperatorPortalGate
  return session.profile.club_id === null;
}

function serverSnapshot(): boolean {
  return false;
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const blocked = useSyncExternalStore(subscribeAuth, needsOnboarding, serverSnapshot);

  if (blocked) return <Onboarding />;
  return <>{children}</>;
}
