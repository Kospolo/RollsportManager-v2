import type { Metadata } from "next";
import { FamilyClient } from "./FamilyClient";

export const metadata: Metadata = { title: "Familie" };

/**
 * Familien-Screen des Portals — zeigt die Familie der eingeloggten Person
 * (Kinder bzw. Eltern/Bezugspersonen). Rein lesend; Daten ausschließlich
 * über die Daten-Facade lib/data (Mock oder api, siehe MIGRATION.md).
 */
export default function FamiliePage() {
  return <FamilyClient />;
}
