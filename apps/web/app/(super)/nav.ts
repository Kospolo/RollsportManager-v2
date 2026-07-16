import type { IconName } from "@/components/shell/icons";
import type { OperatorNavKey } from "./OperatorNav";

/**
 * Einzige Quelle der Betreiber-Navigation ((super)-Ebene) — getrennt von der
 * Vereins-Navigation (components/shell/nav.ts). Weitere Sektionen (Zahlungen,
 * Produkte, System, Einstellungen) hängen die jeweiligen Teams HIER an und
 * ergänzen den passenden Label-Key im operatorNavDict (OperatorNav.tsx).
 *
 * ACHTUNG Routen-Kollision: /einstellungen gehört bereits dem Vereinsportal
 * ((portal)). Die Betreiber-Einstellungen brauchen einen eigenen Pfad (z. B.
 * /plattform-einstellungen), sonst kollidiert `next build` (zwei page.tsx auf
 * denselben URL). Route-Gruppen ((super)/(portal)) verändern die URL NICHT.
 * Aus demselben Grund heißt die Moderation /kueren-moderation und nicht
 * /kueren (das ist die Vereins-Seite) — sie sieht auch etwas anderes: alle
 * Vereine statt einen.
 *
 * EINSTIEG: diese Navigation war vollständig, aber von der laufenden App aus
 * unerreichbar — niemand verlinkte /super. Der Eingang sitzt jetzt im
 * Avatar-Menü der Portal-Topbar (components/shell/UserMenu.tsx), sichtbar nur
 * für Plattform-Admins.
 */

export interface OperatorNavItem {
  key: OperatorNavKey;
  href: string;
  icon: IconName;
}

export const OPERATOR_NAV: OperatorNavItem[] = [
  { key: "navOverview", href: "/super", icon: "dashboard" },
  { key: "navClubs", href: "/vereine", icon: "teams" },
  { key: "navRoutines", href: "/kueren-moderation", icon: "routines" },
  { key: "navSupport", href: "/support-tickets", icon: "mail" },
  { key: "navLicenses", href: "/lizenzen", icon: "shield" },
  { key: "navPayments", href: "/zahlungen", icon: "bank" },
  { key: "navSystem", href: "/system", icon: "zap" },
  { key: "navSettings", href: "/plattform-einstellungen", icon: "settings" },
];
