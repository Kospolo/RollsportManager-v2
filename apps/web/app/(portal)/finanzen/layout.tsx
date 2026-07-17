"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n";
import { useModules } from "@/lib/modules";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Modul-Gate fuer den GESAMTEN Finanzbereich (Migration 0061).
 *
 * Hat der Verein „Finanzen" abgeschaltet, zeigt der ganze /finanzen-Teilbaum
 * (Rechnungen, Beitraege, Kassenbuch, Mahnungen, SEPA, Spenden, Budget,
 * Jahresabschluss, Bankabgleich) EINEN ehrlichen Hinweis statt Finanzdaten —
 * an EINER Stelle, damit keine Unterseite vergessen wird. Der Nutzer war klar:
 * finance aus -> „in keinem bereich was mit finanzen/rechnungen anzeigen".
 *
 * Das ist Ausblenden, NICHT ein 403: der Server ist ohnehin dicht (restriktive
 * RLS-Gates + die Service-Mode-Checks aus lib/module-gate.ts). Direktes
 * Aufrufen einer Finanz-URL landet hier — nicht auf einer halb gefuellten Seite.
 *
 * FAIL-OPEN beim Laden: solange der Modul-Status unbekannt ist (status !=
 * "ready"), werden die Kinder gezeigt. Nur ein SICHER abgeschaltetes Modul
 * blendet aus — ein Ladefehler nimmt dem Verein seine Finanzen nicht weg.
 */
export default function FinanzenLayout({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const { status, isModuleAvailable } = useModules();

  if (status === "ready" && !isModuleAvailable("finance")) {
    return (
      <EmptyState
        icon="finance"
        title={locale === "de" ? "Finanzmodul ausgeschaltet" : "Finance module switched off"}
        body={
          locale === "de"
            ? "Dieser Verein fuehrt seine Finanzen nicht mit dieser App. Die Kassenbuch-Daten bleiben aufbewahrt und sind sofort wieder da, sobald das Modul in der Verwaltung wieder eingeschaltet wird."
            : "This club does not manage its finances in this app. The cash-book data stays retained and reappears the moment the module is switched back on under Administration."
        }
        ctaHref="/verwaltung/module"
        ctaLabel={locale === "de" ? "Zur Modul-Verwaltung" : "Go to module settings"}
      />
    );
  }

  return <>{children}</>;
}
