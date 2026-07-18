"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { dataSource } from "@/lib/data";
import { readSession } from "@/lib/auth/storage";
import { readOperatorClub, subscribeOperatorClub } from "@/lib/data/operator-club";
import { useT, type Dict } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * PORTAL-GATE FÜR DEN BETREIBER OHNE GEWÄHLTEN VEREIN.
 *
 * ### Das Problem, das es abfängt ###
 * Ein Plattform-Admin (Persona 'platform') hat KEINEN eigenen Verein — sein
 * Profil trägt club_id/member_id/club_role = null. Öffnet er eine Portal-Seite
 * (/dashboard etc.), OHNE vorher über „Ansehen" einen Verein gewählt zu haben,
 * lief getCurrentUser() (lib/data/api/index.ts) in den 401 „Nicht angemeldet
 * (Dev-Login fehlt)". Das ist eine Lüge: er IST angemeldet, ihm fehlt nur der
 * Verein. Statt dieses Fehlers zeigt das Gate einen ehrlichen Auswahl-Hinweis.
 *
 * ### Warum kein Redirect, sondern eine Auswahl-Seite ###
 * Der einzige legitime Weg ins fremde Portal führt über den „Ansehen"-Umschalter
 * (app/(super)/ViewClubButton.tsx), der den protokollierten Einsicht-Kontext
 * setzt (OperatorBanner, Audit-Log, Migration 0051). Das Gate baut diesen Weg
 * NICHT nach — es schickt den Betreiber zurück zur Auswahl (/vereine), wo der
 * Umschalter sitzt. So bleibt der Audit-Weg der einzige Einstieg.
 *
 * ### Wen es NICHT betrifft ###
 * Normale Vereins-Nutzer:innen MIT Heimatverein (is_platform_admin ≠ true) laufen
 * unverändert durch — für sie ist /dashboard korrekt. Ein Betreiber MIT aktiver
 * Einsicht (readOperatorClub ≠ null) ebenfalls: sein Portal lädt über
 * operatorMember(). Und im mock-Modus (keine Dev-Session) rendert das Gate
 * transparent — die Demo-Konsole bleibt unberührt.
 */

const gateDict = {
  de: {
    title: "Welchen Verein möchtest du ansehen?",
    body: "Als Plattform-Administrator hast du keinen eigenen Verein. Wähle in der Betreiber-Ebene einen Verein aus — der Zugriff wird dabei protokolliert.",
    cta: "Verein zum Ansehen wählen",
  },
  en: {
    title: "Which club would you like to view?",
    body: "As a platform administrator you have no club of your own. Pick a club in the operator plane — the access is logged.",
    cta: "Choose a club to view",
  },
} satisfies Dict;

/**
 * true, wenn ein Plattform-Admin OHNE aktiven Ansehen-Verein eine Portal-Seite
 * öffnet. Nur im api-Modus relevant; fail-closed über den Plattform-Claim.
 */
function needsClubChoice(): boolean {
  if (dataSource !== "api") return false;
  if (readSession()?.profile.is_platform_admin !== true) return false;
  return readOperatorClub() === null;
}

function serverSnapshot(): boolean {
  return false;
}

export function OperatorPortalGate({ children }: { children: ReactNode }) {
  const t = useT(gateDict);
  // subscribeOperatorClub hört auf Auth UND den Ansehen-Store — wählt der
  // Betreiber gerade einen Verein, verschwindet dieses Gate sofort.
  const blocked = useSyncExternalStore(subscribeOperatorClub, needsClubChoice, serverSnapshot);

  if (blocked) {
    return <EmptyState icon="teams" title={t("title")} body={t("body")} ctaHref="/vereine" ctaLabel={t("cta")} />;
  }

  return <>{children}</>;
}
